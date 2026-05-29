/* global React */

function Btn({ variant = "primary", children, ...rest }) {
  return <button className={"btn btn--" + variant} {...rest}>{children}</button>;
}

function Tag({ tone = "mute", children }) {
  return <span className={"tag tag--" + tone}>{children}</span>;
}

function ProductCard({ p, brand, onClick }) {
  const sold = p.status === "soldout";
  return (
    <article className={"pcard" + (sold ? " is-soldout" : "")}>
      <button className="pcard__imgwrap" onClick={onClick} style={{ background: "none", border: 0, padding: 0, display: "block", width: "100%" }} aria-label={"View " + p.name}>
        <img className="pcard__img" src={p.img} alt={p.name} loading="lazy" />
        {sold && <span className="pcard__tag pcard__tag--mute">Reservation closed</span>}
        {!sold && <span className="pcard__tag pcard__tag--ok">Open · 50% deposit</span>}
      </button>
      <button onClick={onClick} className="pcard__meta" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }}>
        <div className="pcard__brand">{brand.name}</div>
        <div className="pcard__name">
          {p.name}{p.colorway && <span className="pcard__colorway">, {p.colorway}</span>}
        </div>
        <div className="pcard__price">US$ {p.us}</div>
      </button>
    </article>
  );
}

function Segments({ items, value, onChange, counts }) {
  return (
    <div className="segments" role="tablist">
      {items.map((seg) => (
        <button
          key={seg.key}
          role="tab"
          aria-selected={value === seg.key}
          className={"segment" + (value === seg.key ? " is-on" : "")}
          onClick={() => onChange(seg.key)}
        >
          <span>{seg.label}</span>
          {counts && counts[seg.key] != null && <span className="segment__count">· {counts[seg.key]}</span>}
        </button>
      ))}
    </div>
  );
}

function TrustBlock() {
  const items = [
    { h: "Importer of record",  p: "Chariot owns the inventory in the U.S. before it ships. Duties paid. No customs invoice at your door." },
    { h: "Community-validated", p: "We never speculate on inventory. Every piece in a drop was voted in by the founding community before the order was placed." },
    { h: "Refund standard",     p: "Full refund if your order doesn't arrive within 35 days of placement. Returns inside 14 days of delivery, free." }
  ];
  return (
    <section className="trust-block">
      {items.map((x) => (
        <div key={x.h} className="trust-block__cell">
          <div className="trust-block__h">{x.h}</div>
          <p className="trust-block__p">{x.p}</p>
        </div>
      ))}
    </section>
  );
}

Object.assign(window, { Btn, Tag, ProductCard, Segments, TrustBlock });
