import { GoogleGenAI } from "@google/genai";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 1800000; // 30 minutes

function buildPrompt(topic) {
  const code = process.env.CLAW_LANGUAGE || "en";
  const map = {
    "zh-CN": "Simplified Chinese",
    "en": "English"
  };
  const fullName = map[code] || "English";
  if (code === "zh-CN") {
    return `请针对以下主题进行深度研究，并产出一份结构完整的简体中文研究报告。

主题：${topic}

报告需包含：
1. **摘要** — 200 字以内的研究重点摘要
2. **背景** — 主题的背景脉络与重要性
3. **主要发现** — 研究过程中发现的关键信息（至少 3 点）
4. **分析** — 对主要发现的深入分析与比较
5. **结论与建议** — 根据研究结果的结论与可行建议
6. **参考来源** — 所有引用的来源链接

规则：
- 全文使用简体中文
- 所有事实陈述必须附上来源
- 使用 Markdown 格式
- 保持客观中立的语调
- You MUST respond entirely in ${fullName}.`;
  } else {
    return `Please conduct a deep research on the following topic and produce a well-structured research report in English.

Topic: ${topic}

The report must include:
1. **Executive Summary** — A summary of key research findings within 200 words
2. **Background** — Context and importance of the topic
3. **Key Findings** — Critical information discovered during the research (at least 3 points)
4. **Analysis** — In-depth analysis and comparison of the key findings
5. **Conclusion & Recommendations** — Conclusion and actionable recommendations based on the findings
6. **References** — All cited source links

Rules:
- The entire response must be in English
- All factual claims must have sources cited
- Use Markdown formatting
- Keep an objective and neutral tone
- You MUST respond entirely in ${fullName}.`;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function getTopic() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args.join(" ");
  }
  if (!process.stdin.isTTY) {
    const input = await readStdin();
    if (input) return input;
  }
  console.error("错误：请提供研究主题。");
  console.error("用法：node scripts/research.js \"研究主题\"");
  process.exit(1);
}

async function main() {
  const topic = await getTopic();
  const prompt = buildPrompt(topic);

  // Dry-run mode
  if (process.env.DEEP_RESEARCHER_DRY_RUN === "1") {
    const preview = {
      agent: "deep-research",
      background: true,
      prompt,
      topic,
      note: "Dry-run mode — 不会呼叫 Gemini API",
    };
    process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("错误：请设定 GEMINI_API_KEY 或 GOOGLE_API_KEY 环境变数。");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  // 1. Start the background research
  console.error("正在启动深度研究...");
  const initialResponse = await client.interactions.create({
    agent: "deep-research-pro-preview-12-2025",
    input: prompt,
    background: true,
  });

  const interactionId = initialResponse.id;
  console.error(`研究任务已建立（ID: ${interactionId}），等待完成...`);

  // 2. Poll until complete (no timeout — keep going as long as not failed)
  let elapsed = 0;

  while (elapsed < MAX_POLL_TIME_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    elapsed += POLL_INTERVAL_MS;

    const status = await client.interactions.get(interactionId);

    if (status.status === "completed") {
      if (status.output_text) {
        process.stdout.write(status.output_text);
        process.stdout.write("\n");
      } else if (status.steps && status.steps.length > 0) {
        for (const step of status.steps) {
          if (step.type === "model_output" || step.type === "text" || step.content) {
            if (step.text) {
              process.stdout.write(step.text);
            } else if (Array.isArray(step.content)) {
              for (const part of step.content) {
                if (part.type === "text" && part.text) {
                  process.stdout.write(part.text);
                } else if (part.text) {
                  process.stdout.write(part.text);
                }
              }
            }
          }
        }
        process.stdout.write("\n");
      } else {
        const outputs = status.outputs ?? status.output;
        if (outputs && outputs.length > 0) {
          const last = outputs[outputs.length - 1];
          if (last.text) {
            process.stdout.write(last.text);
          } else {
            for (const part of outputs) {
              if (part.type === "text" && part.text) {
                process.stdout.write(part.text);
              }
            }
          }
          process.stdout.write("\n");
        }
      }
      console.error("研究完成！");
      return;
    }

    if (status.status === "failed") {
      throw new Error(
        `研究任务失败：${status.error?.message || "未知错误"}`,
      );
    }

    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    console.error(`等待中... (${minutes}m${seconds}s)`);
  }

  throw new Error(
    `研究任务逾时（超过 ${MAX_POLL_TIME_MS / 60000} 分钟），任务 ID: ${interactionId}`,
  );
}

main().catch((err) => {
  console.error(`错误：${err.message}`);
  process.exit(1);
});
