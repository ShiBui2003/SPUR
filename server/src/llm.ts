import Groq from 'groq-sdk';

const SYSTEM_INSTRUCTION = `You are a helpful customer support agent for a fictional e-commerce store called ShopEase. Answer clearly and concisely.

STORE KNOWLEDGE:

Shipping Policy:
- Free shipping on orders above ₹999
- Standard delivery takes 3–5 business days
- Express delivery is available for an additional fee at checkout

Return & Refund Policy:
- 7-day return window from the date of delivery
- Items must be unused, unwashed, and in original packaging with tags intact
- Refunds are processed within 5–7 business days once the return is received and verified
- To initiate a return, email returns@shopease.com with your order ID

Support Hours:
- Monday to Saturday, 10:00 AM – 6:00 PM IST
- Closed on Sundays and public holidays
- For urgent issues outside support hours, email support@shopease.com

If a customer asks about a specific order (status, tracking, etc.) and you don't have that information, politely ask for their order ID and let them know you'll look into it.`;

export interface HistoryMessage {
  sender: string;
  text: string;
}

export async function generateReply(
  history: HistoryMessage[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const client = new Groq({ apiKey });

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map((msg) => ({
      role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.text,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content ?? '';
}
