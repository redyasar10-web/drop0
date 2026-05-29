/* global React, Wordmark */
const { useState } = React;

function TopBar() {
  return (
    <div className="topbar">
      <span>Drop 01 · 14 days · 1NRI from Accra · The first U.S. window opens soon</span>
    </div>
  );
}

function Header({ route, go, cart, overVideo = false }) {
  const nav = [
    { label: "Drop 01", r: { name: "shop", segment: "all" } },
    { label: "1NRI",    r: { name: "brand", slug: "1nri" } },
    { label: "Jireh",   r: { name: "brand", slug: "jireh" } },
    { label: "How it works", r: { name: "about" } }
  ];
  const active = (r) =>
    (route.name === r.name) &&
    (r.slug ? route.slug === r.slug : true) &&
    (r.segment ? route.segment === r.segment : true);

  return (
    <header className={"header" + (overVideo ? " header--over-video" : "")}>
      <div className="header__row">
        <button className="header__logo" onClick={() => go({ name: "home" })} aria-label="Chariot home">
          <img className="logo-dark"  src="assets/chariot-logo.png"       alt="Chariot" />
          <img className="logo-light" src="assets/chariot-logo-white.png" alt="Chariot" />
        </button>
        <nav className="header__nav" aria-label="Primary">
          {nav.map((l) => (
            <button key={l.label} className={"navlink" + (active(l.r) ? " is-active" : "")} onClick={() => go(l.r)}>
              {l.label}
            </button>
          ))}
        </nav>
        <div className="header__util">
          <button className="iconbtn" aria-label="Search"><SearchIcon /></button>
          <button className="iconbtn" aria-label="Account"><AccountIcon /></button>
          <button className="iconbtn" aria-label="Bag" onClick={() => cart.setOpen(true)}>
            <BagIcon />
            {cart.count > 0 && <span className="iconbtn__count">{cart.count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer({ go }) {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brandcol">
          <img src="assets/chariot-logo-white.png" alt="Chariot" style={{ height: 28 }} />
          <p className="footer__tag">What the rest of the world is already wearing.</p>
          <p className="footer__tag footer__tag--muted">Community-validated import drops. Imported into the U.S., shipped from New York, duties paid.</p>
        </div>
        <div className="footer__col">
          <div className="footer__h">Drop 01</div>
          <button onClick={() => go({ name: "shop", segment: "all" })}>The full drop</button>
          <button onClick={() => go({ name: "shop", segment: "available" })}>Voted in</button>
          <button onClick={() => go({ name: "shop", segment: "Tops" })}>Tops</button>
          <button onClick={() => go({ name: "shop", segment: "Bottoms" })}>Bottoms</button>
          <button onClick={() => go({ name: "shop", segment: "Accessories" })}>Accessories</button>
        </div>
        <div className="footer__col">
          <div className="footer__h">Brands</div>
          <button onClick={() => go({ name: "brand", slug: "1nri" })}>1NRI</button>
          <button onClick={() => go({ name: "brand", slug: "jireh" })}>Jireh</button>
        </div>
        <div className="footer__col">
          <div className="footer__h">Service</div>
          <a href="#/">Shipping &amp; returns</a>
          <a href="#/">Size guide</a>
          <a href="#/">Contact</a>
          <button onClick={() => go({ name: "about" })}>About Chariot</button>
          <a href="mailto:care@chariot.nyc">care@chariot.nyc</a>
        </div>
      </div>
      <div className="footer__legal">
        <span>© 2026 Chariot Commerce, Inc.</span>
        <span>New York, NY · Importer of record</span>
        <span>Accra → New York · 14-day window</span>
      </div>
    </footer>
  );
}

function SearchIcon() { return (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
); }
function AccountIcon() { return (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 14c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
); }
function BagIcon() { return (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5h10l-.7 9.2a.8.8 0 01-.8.8H4.5a.8.8 0 01-.8-.8L3 5z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 5V4a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.3"/></svg>
); }

Object.assign(window, { TopBar, Header, Footer, SearchIcon, AccountIcon, BagIcon });
