/** Formato básico como elementos React; nunca interpreta HTML de la respuesta. */
export function ChatText({ text }: { text: string }) {
  const readable = text.replace(/\\\(([^\n]*?)\\\)/g, (_, formula: string) =>
    formula.replace(/\\times\b/g, '×').replace(/\\cdot\b/g, '·'),
  )
  return (
    <>
      {readable
        .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
        .map((part, index) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={index}>{part.slice(2, -2)}</strong>
          ) : part.startsWith('`') && part.endsWith('`') ? (
            <code key={index}>{part.slice(1, -1)}</code>
          ) : (
            part
          ),
        )}
    </>
  )
}
