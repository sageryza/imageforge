// ─── UPDATED: Extract visual moments from a date description ─────────
// Replace the existing /api/generate/moments endpoint in ImageForge server.js
// v3: Better prompts — physical descriptions instead of labels, narrator described

app.post('/api/generate/moments', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You help illustrate a dating memoir written by a young woman. Given a date description, extract small, specific, visual moments that would make good simple watercolor-style drawings.

THE AUTHOR/NARRATOR: A petite young woman with curly brown hair. Whenever she appears in a scene, describe her this way. NEVER write "the narrator", "the author", or "the woman" — always use a physical description like "a petite girl with curly brown hair".

CRITICAL RULES:
- ONLY extract moments that are explicitly described in the text. Never invent or assume details.
- Each moment should be a concrete detail — an object, a scene, a gesture — not an abstract feeling.
- If the text only contains 2-3 clear visual moments, return only 2-3. Do NOT pad to 6 with invented scenes.
- Return UP TO 6 moments, but fewer is fine if the text is short.
- ALWAYS describe people by their physical appearance as mentioned in the text (tall, skinny, pale, bearded, etc). If the text describes what someone looks like, USE that description in the prompt. Never just say "a man" or "a person" — pull details from the text.
- Focus on specific objects, gestures, and compositions rather than full complex scenes. The best prompts are simple: one or two subjects, a clear action or arrangement.
- Avoid prompts that require precise spatial relationships between many elements — these confuse image generators.

For each moment, provide:
- "moment": a short 3-5 word label
- "prompt": a detailed image generation prompt for a soft watercolor illustration, under 50 words. Always start with "Soft watercolor illustration of" and end with "minimal background, gentle muted palette"

Return valid JSON only, no markdown fences. The JSON should be an array of objects with "moment" and "prompt" fields.`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const moments = JSON.parse(cleaned);
    res.json({ moments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
