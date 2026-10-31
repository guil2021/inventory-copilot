import { useState } from 'react';
import { askAgent } from '../api';

// Natural-language Q&A, backed by two specialized LangChain agents on the
// backend (Inventory Agent + Pricing Agent) behind a router. Each answer
// shows which agent(s) handled it, how long it took, and how many tokens
// it used - the instrumentation the live demo needs to show.
export default function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Ask me about stock levels or pricing, e.g. "What products are low on stock?" or "Should we discount the Office Chair?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Runs when the chat form is submitted: show the user's question right
  // away, call the backend, then build a short stats string out of the
  // instrumentation fields before showing the bot's reply.
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const question = input.trim();
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const { answer, agentsUsed, latencyMs, tokenUsage } = await askAgent(question);
      // Keep the raw instrumentation fields on the message (instead of a
      // pre-built string) so the render below can show them as separate,
      // color-coded chips rather than one plain line of text.
      setMessages((m) => [
        ...m,
        { role: 'bot', text: answer, agentsUsed, latencyMs, tokenUsage },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Ask the Copilot</h3>
        <span className="card-sub">multi-agent · instrumented</span>
      </div>
      <div className="chat-log">
        {messages.map((m, i) => {
          // A reply handled by exactly one agent gets that agent's own
          // color (on both the avatar and the "which agent" chip), so
          // you can tell which specialist answered at a glance. A "both"
          // answer, the welcome message, or an error keeps the neutral
          // look - no single color would be honest for those.
          const singleAgent = m.agentsUsed && m.agentsUsed.length === 1 ? m.agentsUsed[0] : null;
          const agentClass = singleAgent ? `agent-${singleAgent}` : '';
          return (
            <div key={i} className={`chat-row ${m.role}`}>
              <span className={`avatar ${m.role} ${agentClass}`} aria-hidden="true">
                {m.role === 'bot' ? '🤖' : 'U'}
              </span>
              <div className={`chat-bubble ${m.role}`}>
                {m.text}
                {/* Only bot replies that actually hit the backend carry
                    instrumentation fields - the static welcome message
                    and plain error messages don't, so this stays hidden
                    for those. */}
                {m.agentsUsed && (
                  <div className="stat-chips">
                    <span className={`stat-chip ${agentClass}`}>
                      {m.agentsUsed.join(' + ')} agent{m.agentsUsed.length > 1 ? 's' : ''}
                    </span>
                    <span className="stat-chip latency">{m.latencyMs}ms</span>
                    <span className="stat-chip tokens">
                      {m.tokenUsage.totalTokens} tokens ({m.tokenUsage.promptTokens} in /{' '}
                      {m.tokenUsage.completionTokens} out)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="chat-row bot">
            <span className="avatar bot" aria-hidden="true">🤖</span>
            <div className="chat-bubble bot">Thinking...</div>
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={handleSend}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about stock levels or pricing..."
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>
    </div>
  );
}
