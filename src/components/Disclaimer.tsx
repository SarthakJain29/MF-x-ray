export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-ink-3 ${className}`}>
      <strong className="font-semibold text-ink-2">Educational tool, not investment advice.</strong> MF X-ray is not a SEBI-registered investment
      adviser. It shows facts about your portfolio and explains concepts; it does not recommend buying, selling or switching any fund and does not
      forecast returns. Past performance is not indicative of future returns. Data may be incomplete or out of date — verify with your CAS and fund house.
    </p>
  );
}
