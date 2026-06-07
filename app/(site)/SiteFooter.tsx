// Shared site footer (design-truth). Static; the year is filled by SiteScripts.
export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="footer__brandcol">
            <img className="footer__mark" src="/chariot-wm-tight-white.png" alt="Chariot" width={130} />
            <p className="footer__mission">
              Accra. Austin. What the rest of the world is already wearing.
            </p>
            <p className="footer__note">
              Community-validated import drops. Imported into the US, shipped from Austin, duties paid.
            </p>
          </div>
          <div className="footer__col">
            <div className="footer__h">Drop 0</div>
            <a href="/#claim">The Founding Fifty</a>
            <a href="/#offer">What you get</a>
            <a href="/#selection">The lookbook</a>
            <a href="/#process">How it works</a>
          </div>
          <div className="footer__col">
            <div className="footer__h">Chariot</div>
            <a href="/about">About</a>
            <a href="#">The Archive</a>
            <a href="/support">Support</a>
            <a href="/account">Account</a>
          </div>
          <div className="footer__col">
            <div className="footer__h">Connect</div>
            <a href="https://chariotarchive.com" target="_blank" rel="noreferrer">
              @chariotarchive
            </a>
            <a href="/support">Customer support</a>
          </div>
        </div>
        <div className="footer__legal">
          <span>© <span data-year>2026</span> Chariot Archive Inc.</span>
          <span>Austin, TX · Importer of record</span>
          <span>Accra → Austin · 14-day window</span>
        </div>
      </div>
    </footer>
  )
}
