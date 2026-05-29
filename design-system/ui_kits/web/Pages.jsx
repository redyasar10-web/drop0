/* global React, PRODUCTS, BRANDS, SHOP_SEGMENTS, ProductCard, Segments, TrustBlock, Btn, Tag */
const { useState, useEffect, useMemo, useRef } = React;

// ───────────────────────── HOME ─────────────────────────
function HomePage({ go, setHeaderOverVideo }) {
  const videoRef = useRef(null);

  // Tell the header to go transparent while user is at the top (video hero visible)
  useEffect(() => {
    const onScroll = () => setHeaderOverVideo(window.scrollY < 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setHeaderOverVideo(false);
    };
  }, [setHeaderOverVideo]);

  const available = PRODUCTS.filter((p) => p.status === "available");
  const nri       = PRODUCTS.filter((p) => p.brand === "1nri"  && p.status === "available");
  const featured  = nri.slice(0, 4);

  // Drop counters — strategy doc: visible unit counter, 14-day window
  const totalUnits = 30;
  const reservedUnits = 17;
  const remaining = totalUnits - reservedUnits;
  const closeDate = "August 28, 2026";
  const daysLeft = 9;

  return (
    <main>
      {/* ── Video hero ── */}
      <section className="hero-video">
        <video ref={videoRef} src="assets/hero.mp4" autoPlay muted loop playsInline poster="assets/jireh/campaign-02.jpg" />
        <div className="hero-video__content">
          <div className="hero-video__eyebrow">Drop 01 · 1NRI · Accra → New York</div>
          <h1 className="hero-video__h">What the rest of the world<br/><em>is already wearing.</em></h1>
          <p className="hero-video__p">Chariot brings independent fashion from cities the American market hasn't caught up to yet. The community votes the drop. We import the inventory. The piece ships from New York.</p>
          <div className="hero-video__cta">
            <Btn variant="cream" onClick={() => go({ name: "shop", segment: "all" })}>See Drop 01</Btn>
            <Btn variant="ghost" style={{ color: "var(--c-cream)", borderColor: "rgba(250,247,240,0.6)" }} onClick={() => go({ name: "about" })}>How a drop works</Btn>
          </div>
          <div className="hero-video__trust">
            <span>1NRI · Accra · Since 2021</span>
            <span>30 units total · {remaining} left</span>
            <span>Window closes {closeDate}</span>
          </div>
        </div>
      </section>

      {/* ── Drop counter strip ── */}
      <section className="dropbar">
        <div className="dropbar__col">
          <div className="dropbar__lbl">Drop</div>
          <div className="dropbar__val">01 — 1NRI</div>
        </div>
        <div className="dropbar__col">
          <div className="dropbar__lbl">Window</div>
          <div className="dropbar__val">14 days · {daysLeft} left</div>
        </div>
        <div className="dropbar__col">
          <div className="dropbar__lbl">Units reserved</div>
          <div className="dropbar__val">{reservedUnits} / {totalUnits}</div>
          <div className="dropbar__bar"><span style={{ width: (reservedUnits/totalUnits*100) + "%" }} /></div>
        </div>
        <div className="dropbar__col">
          <div className="dropbar__lbl">Deposit</div>
          <div className="dropbar__val">50% to reserve · balance on ship</div>
        </div>
      </section>

      {/* ── Voice / positioning band ── */}
      <section className="band">
        <div className="band__inner">
          <p className="band__lead">1NRI has been dressing Accra's creative class since 2021. This is their first U.S. window. We physically handled every piece in the drop before it was listed.</p>
          <div className="band__cols">
            <div>
              <div className="eyebrow eyebrow--gold">The piece</div>
              <p>Pulled from 1NRI's spring catalog — the four pieces our founding community voted in. Heavyweight cotton, tonal embroidery, raw hems. Construction documented at <button className="linkbtn" onClick={() => go({ name: "brand", slug: "1nri" })}>1NRI</button>.</p>
            </div>
            <div>
              <div className="eyebrow eyebrow--gold">The order</div>
              <p>Reserve with a 50% deposit before {closeDate}. We place the wholesale order the day the window closes. Pieces clear customs into our Queens warehouse and ship to you in 21–28 days.</p>
            </div>
            <div>
              <div className="eyebrow eyebrow--gold">The price</div>
              <p>Listed in U.S. dollars, duties and domestic shipping included. No customs invoice at your door. Full refund if the piece doesn't arrive within 35 days of order placement.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured drop ── */}
      <section className="section">
        <div className="section__head">
          <div>
            <div className="eyebrow eyebrow--gold">Drop 01 · The four</div>
            <h2>Voted in by the founding community.</h2>
          </div>
          <button className="linkbtn" onClick={() => go({ name: "shop", segment: "all" })}>See all reservations →</button>
        </div>
        <div className="feat-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} p={p} brand={BRANDS[p.brand]} onClick={() => go({ name: "product", id: p.id })} />
          ))}
        </div>
      </section>

      {/* ── How a drop works (six-step strategy doc sequence, condensed to 4) ── */}
      <section className="hiw">
        <div className="hiw__step">
          <span className="hiw__n">01</span>
          <h3>Community votes the drop</h3>
          <p>Founding members get a shortlist of pieces handled in person and rated against four selection gates. The community picks the four.</p>
        </div>
        <div className="hiw__step">
          <span className="hiw__n">02</span>
          <h3>14-day reservation window</h3>
          <p>50% deposit reserves your size. Visible unit counter. When the window closes, the wholesale order is placed.</p>
        </div>
        <div className="hiw__step">
          <span className="hiw__n">03</span>
          <h3>Imported into New York</h3>
          <p>Chariot is the importer of record. We pay the duties, clear customs, and stock the inventory in our Queens warehouse.</p>
        </div>
        <div className="hiw__step">
          <span className="hiw__n">04</span>
          <h3>Ships domestic</h3>
          <p>UPS / USPS · 2–4 business days from New York. Full refund if the order doesn't arrive within 35 days of placement.</p>
        </div>
      </section>

      {/* ── Brand split module ── */}
      <section className="brands">
        <button className="brandcard" onClick={() => go({ name: "brand", slug: "1nri" })} aria-label="1NRI brand page">
          <img src={BRANDS["1nri"].cover} alt="1NRI" />
          <div className="brandcard__meta">
            <div className="eyebrow eyebrow--gold">Accra · Since 2021</div>
            <div className="brandcard__h">1NRI</div>
            <p className="brandcard__p">{BRANDS["1nri"].tag}</p>
            <span className="linkbtn" style={{ color: "var(--c-cream)" }}>Drop 01 →</span>
          </div>
        </button>
        <button className="brandcard" onClick={() => go({ name: "brand", slug: "jireh" })} aria-label="Jireh brand page">
          <img src={BRANDS["jireh"].cover} alt="Jireh" />
          <div className="brandcard__meta">
            <div className="eyebrow eyebrow--gold">Accra · On the shortlist</div>
            <div className="brandcard__h">Jireh</div>
            <p className="brandcard__p">{BRANDS["jireh"].tag}</p>
            <span className="linkbtn" style={{ color: "var(--c-cream)" }}>Read the case →</span>
          </div>
        </button>
      </section>

      {/* ── Trust block ── */}
      <TrustBlock />

      {/* ── Rest of available grid ── */}
      <section className="section section--offwhite">
        <div className="section__head">
          <div>
            <div className="eyebrow eyebrow--gold">The full drop</div>
            <h2>{available.length} pieces under reservation.</h2>
          </div>
          <button className="linkbtn" onClick={() => go({ name: "shop", segment: "all" })}>See archive →</button>
        </div>
        <div className="plp-grid">
          {available.map((p) => (
            <ProductCard key={p.id} p={p} brand={BRANDS[p.brand]} onClick={() => go({ name: "product", id: p.id })} />
          ))}
        </div>
      </section>

      {/* ── Founding circle ── */}
      <section className="joinband">
        <div className="eyebrow eyebrow--gold">Founding circle</div>
        <h2>The drop opens to founding members 24 hours early.</h2>
        <p>We email when a new shortlist goes up for vote, when a window opens, and when a piece you reserved leaves Queens. Nothing else.</p>
        <form onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="you@example.com" aria-label="Email address" />
          <button type="submit">Request access</button>
        </form>
      </section>
    </main>
  );
}

// ───────────────────────── SHOP ─────────────────────────
function ShopPage({ go, segment = "all" }) {
  const [sort, setSort] = useState("featured");
  const list = useMemo(() => {
    let xs = PRODUCTS.slice();
    if (segment === "1nri")        xs = xs.filter((p) => p.brand === "1nri");
    else if (segment === "jireh")  xs = xs.filter((p) => p.brand === "jireh");
    else if (segment === "available") xs = xs.filter((p) => p.status === "available");
    else if (segment === "soldout")   xs = xs.filter((p) => p.status === "soldout");
    else if (["Tops","Outerwear","Bottoms","Accessories"].includes(segment)) {
      xs = xs.filter((p) => p.category === segment);
    }
    // Always list available first, sold out second (unless sold-out segment)
    if (segment !== "soldout") {
      xs = xs.slice().sort((a, b) => (a.status === "soldout") - (b.status === "soldout"));
    }
    if (sort === "price-asc")  xs = xs.slice().sort((a, b) => a.us - b.us);
    if (sort === "price-desc") xs = xs.slice().sort((a, b) => b.us - a.us);
    return xs;
  }, [segment, sort]);

  const counts = useMemo(() => {
    const c = { all: PRODUCTS.length };
    for (const seg of SHOP_SEGMENTS) {
      if (seg.key === "all") continue;
      if (seg.key === "1nri")           c[seg.key] = PRODUCTS.filter((p) => p.brand === "1nri").length;
      else if (seg.key === "jireh")     c[seg.key] = PRODUCTS.filter((p) => p.brand === "jireh").length;
      else if (seg.key === "available") c[seg.key] = PRODUCTS.filter((p) => p.status === "available").length;
      else if (seg.key === "soldout")   c[seg.key] = PRODUCTS.filter((p) => p.status === "soldout").length;
      else c[seg.key] = PRODUCTS.filter((p) => p.category === seg.key).length;
    }
    return c;
  }, []);

  const segLabel = SHOP_SEGMENTS.find((s) => s.key === segment)?.label || "Shop";
  const availableCount = list.filter((p) => p.status === "available").length;

  return (
    <main className="shop">
      <div className="shop__head">
        <div>
          <div className="eyebrow eyebrow--gold">Drop 01 · 14-day window</div>
          <h1 className="shop__h">{segLabel}</h1>
        </div>
        <div className="shop__meta">
          <span>{list.length} piece{list.length === 1 ? "" : "s"}</span>
          {availableCount > 0 && segment !== "soldout" && <> &nbsp;·&nbsp; <span>{availableCount} in stock</span></>}
        </div>
      </div>

      <div className="shop__bar">
        <Segments items={SHOP_SEGMENTS} value={segment} onChange={(k) => go({ name: "shop", segment: k })} counts={counts} />
        <div className="shop__sort">
          <label className="eyebrow" htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price · low to high</option>
            <option value="price-desc">Price · high to low</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="shop__empty">
          <p>Nothing in this segment yet.</p>
          <Btn variant="ghost" onClick={() => go({ name: "shop", segment: "all" })}>See all pieces</Btn>
        </div>
      ) : (
        <div className="plp-grid">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} brand={BRANDS[p.brand]} onClick={() => go({ name: "product", id: p.id })} />
          ))}
        </div>
      )}
    </main>
  );
}

// ───────────────────────── BRAND ─────────────────────────
function BrandPage({ brand, go, setHeaderOverVideo }) {
  useEffect(() => {
    const onScroll = () => setHeaderOverVideo(window.scrollY < 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setHeaderOverVideo(false);
    };
  }, [setHeaderOverVideo]);

  const list = PRODUCTS.filter((p) => p.brand === brand.slug);
  const available = list.filter((p) => p.status === "available");
  const sold      = list.filter((p) => p.status === "soldout");

  return (
    <main>
      <section className="bhero">
        <div className="bhero__img">
          {brand.slug === "jireh"
            ? <video src="assets/jireh-hero.mp4" autoPlay muted loop playsInline poster={brand.cover} />
            : <img src={brand.cover} alt={brand.name} />}
        </div>
        <div className="bhero__copy">
          <div className="bhero__meta">{brand.city} · Since {brand.since}</div>
          <h1 className="bhero__h">{brand.name}</h1>
          <p className="bhero__p">{brand.tag}</p>
          <p className="bhero__sub">{brand.desc}</p>
          <div className="bhero__cta">
            <Btn variant="cream" onClick={() => go({ name: "shop", segment: brand.slug })}>Shop {brand.name}</Btn>
            <a className="linkbtn" href={brand.source} target="_blank" rel="noreferrer" style={{ color: "var(--c-cream)" }}>Origin store ↗</a>
          </div>
        </div>
      </section>

      {available.length > 0 && (
        <section className="section">
          <div className="section__head">
            <div>
              <div className="eyebrow eyebrow--gold">Available now</div>
              <h2>Ships from New York</h2>
            </div>
            <span className="shop__meta">{available.length} piece{available.length === 1 ? "" : "s"}</span>
          </div>
          <div className="plp-grid">
            {available.map((p) => (
              <ProductCard key={p.id} p={p} brand={brand} onClick={() => go({ name: "product", id: p.id })} />
            ))}
          </div>
        </section>
      )}

      {sold.length > 0 && (
        <section className="section section--offwhite">
          <div className="section__head">
            <div>
              <div className="eyebrow eyebrow--gold">Sold out archive</div>
              <h2>Past pieces from {brand.name}</h2>
            </div>
            <span className="shop__meta">{sold.length} piece{sold.length === 1 ? "" : "s"}</span>
          </div>
          <div className="plp-grid">
            {sold.map((p) => (
              <ProductCard key={p.id} p={p} brand={brand} onClick={() => go({ name: "product", id: p.id })} />
            ))}
          </div>
        </section>
      )}

      <TrustBlock />
    </main>
  );
}

// ───────────────────────── PDP ─────────────────────────
function ProductPage({ product, brand, go, cart }) {
  const [size, setSize] = useState("M");
  const [activeImg, setActiveImg] = useState(0);
  const sizes = product.category === "Accessories" ? ["OS"] : ["XS","S","M","L","XL"];
  const gallery = product.images && product.images.length > 0 ? product.images : [product.img];
  const related = PRODUCTS.filter((p) => p.brand === product.brand && p.id !== product.id && p.status === "available").slice(0, 4);
  const sold = product.status === "soldout";

  const addToBag = () => cart.add(product, sizes[0] === "OS" ? "OS" : size);

  return (
    <main className="pdp">
      <nav className="pdp__crumbs" aria-label="Breadcrumb">
        <button className="linkbtn" onClick={() => go({ name: "home" })}>Home</button> <span>/</span>
        <button className="linkbtn" onClick={() => go({ name: "shop", segment: "all" })}>Shop</button> <span>/</span>
        <button className="linkbtn" onClick={() => go({ name: "brand", slug: brand.slug })}>{brand.name}</button> <span>/</span>
        <span className="pdp__crumbs-curr">{product.name}</span>
      </nav>

      <div className="pdp__layout">
        <div>
          <div className="pdp__hero">
            <img className="pdp__heroimg" src={gallery[activeImg]} alt={product.name} />
            {sold && <div className="pdp__stamp">Sold out · archive</div>}
          </div>
          {gallery.length > 1 && (
            <div className="pdp__thumbs">
              {gallery.map((g, i) => (
                <button key={g + i} className={"pdp__thumb" + (activeImg === i ? " is-on" : "")} onClick={() => setActiveImg(i)} aria-label={"View " + (i + 1)}>
                  <img src={g} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="pdp__panel">
          <div className="pdp__brand">
            <button className="linkbtn" onClick={() => go({ name: "brand", slug: brand.slug })}>{brand.name}</button>
            <span>· {brand.city.split(",")[0]}</span>
          </div>
          <h1 className="pdp__name">{product.name}</h1>
          {product.colorway && <div className="pdp__colorway">{product.colorway}</div>}

          <div className="pdp__price">
            <span className="pdp__us">US$ {product.us}</span>
            <span className="pdp__gh">50% deposit reserves · balance on ship · duties paid by Chariot</span>
          </div>

          <div className="pdp__status">
            {sold ? <Tag tone="mute">Reservation closed · archive</Tag> : <Tag tone="ok">Open · reserves before window closes</Tag>}
          </div>

          {!sold && (
            <div>
              <div className="pdp__rowhead">
                <span className="eyebrow eyebrow--gold">Size · {sizes[0] === "OS" ? "One size" : size}</span>
                <a className="linkbtn" href="#/">Size guide</a>
              </div>
              <div className="pdp__sizes">
                {sizes.map((s) => (
                  <button key={s} className={"sizebtn" + (size === s ? " is-on" : "")} onClick={() => setSize(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pdp__actions">
            {sold
              ? <Btn variant="primary" disabled>Window closed · archive piece</Btn>
              : <Btn variant="primary" onClick={addToBag}>Reserve with US$ {Math.round(product.us / 2)} · 50% deposit</Btn>}
            <button className="wishbtn" aria-label="Save for later">♡</button>
          </div>

          <div className="pdp__trust">
            <div><span>Window</span><b>Closes Aug 28, 2026</b></div>
            <div><span>Wholesale</span><b>Order placed when window closes</b></div>
            <div><span>Customs</span><b>Cleared into Queens, NY · 21–28 days</b></div>
            <div><span>Refund</span><b>Full refund if not delivered in 35 days</b></div>
          </div>

          <div className="pdp__desc">
            <h3>Details</h3>
            <p>{product.desc}</p>
            <ul className="pdp__facts">
              <li><span>Brand</span><b>{brand.name}</b></li>
              <li><span>Made in</span><b>{brand.city}</b></li>
              <li><span>Category</span><b>{product.category}</b></li>
              <li><span>Colorway</span><b>{product.colorway || "As shown"}</b></li>
              <li><span>SKU</span><b>CHR-{product.id.toUpperCase()}</b></li>
            </ul>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section section--offwhite" style={{ marginTop: 48 }}>
          <div className="section__head">
            <div>
              <div className="eyebrow eyebrow--gold">More from {brand.name}</div>
              <h2>Ships from New York</h2>
            </div>
            <button className="linkbtn" onClick={() => go({ name: "brand", slug: brand.slug })}>All {brand.name} →</button>
          </div>
          <div className="feat-grid">
            {related.map((p) => (
              <ProductCard key={p.id} p={p} brand={brand} onClick={() => go({ name: "product", id: p.id })} />
            ))}
          </div>
        </section>
      )}

      <TrustBlock />
    </main>
  );
}

// ───────────────────────── ABOUT / HOW IT WORKS ─────────────────────────
function AboutPage() {
  return (
    <main>
      <section className="about">
        <div className="eyebrow eyebrow--gold about__kicker">How a drop works</div>
        <h1 className="about__h">You don't buy from Chariot.<br/><em>You build the drop with your vote, and receive what you built.</em></h1>
        <p className="about__lead">Chariot is the only retailer that brings fashion from cities the American market hasn't caught up to yet — for people who already know what the rest of the world is wearing. We don't speculate on inventory. We don't dropship. The community votes the drop, the deposits prove the demand, the wholesale order goes in, and the pieces clear customs into our Queens warehouse before they ship to you.</p>
      </section>

      <section className="about__steps">
        {[
          ["01", "Community signal",     "Founding members tell us what they're hunting for and what brands they already know. We run that signal through a four-gate selection process — visceral, origin, construction, drop coherence."],
          ["02", "Shortlist · Vote",     "Three to five pieces are physically handled in Accra. Photos, fabric weight, finishing notes go to the community. The community votes the drop."],
          ["03", "14-day window",        "The drop opens. Founding members get 24 hours first. Visible unit counter. 50% deposit reserves your size. The window closes on a fixed date."],
          ["04", "Wholesale · Import",   "Window closes, the wholesale order goes to the brand. Chariot is the importer of record. We pay the duties, clear customs, and stock the inventory."],
          ["05", "Ships from New York",  "Domestic UPS / USPS. 2–4 business days. The price you saw on the listing is the price you paid — duties and shipping already in."],
          ["06", "Refund standard",      "If the order doesn't arrive within 35 days of placement, we refund you in full. Returns inside 14 days of delivery, free, to a New York address."]
        ].map(([n, h, p]) => (
          <article key={n} className="about__step">
            <div className="about__n">{n}</div>
            <h3>{h}</h3>
            <p>{p}</p>
          </article>
        ))}
      </section>

      <section className="band band--quiet">
        <div className="band__inner">
          <div className="eyebrow eyebrow--gold">What we're not</div>
          <div className="band__cols">
            <div>
              <h4>Not a marketplace.</h4>
              <p>We don't aggregate every brand from everywhere and let you sort by price. We carry a short list of brands we have relationships with.</p>
            </div>
            <div>
              <h4>Not a dropshipper.</h4>
              <p>We are the importer of record. We own the inventory in the U.S. before you order it. That's the difference between this experience and buying direct.</p>
            </div>
            <div>
              <h4>Not a cultural project.</h4>
              <p>We are a fashion company. We source from places the American market has ignored because the fashion is genuinely better — not out of obligation.</p>
            </div>
          </div>
        </div>
      </section>

      <TrustBlock />
    </main>
  );
}

// ───────────────────────── ORDER ─────────────────────────
function OrderPage({ id, go }) {
  const order = {
    id: id || "CHR-21078",
    placed: "Apr 22, 2026",
    ship:   "Apr 24, 2026",
    address:"Flatiron, New York NY 10010",
    items: [
      { id: "nri-olive-grove",  size: "M" },
      { id: "jir-ba-orange-grey", size: "L" }
    ]
  };
  const lines = order.items.map((x) => ({ ...x, product: PRODUCTS.find((p) => p.id === x.id) })).filter((x) => x.product);
  const subtotal = lines.reduce((s, x) => s + x.product.us, 0);
  const shipping = subtotal >= 150 ? 0 : 12;

  return (
    <main className="order">
      <div className="order__head">
        <div className="eyebrow eyebrow--gold">Order confirmed</div>
        <h1>{order.id}</h1>
        <p>Thanks. Your bag is packed and out the door tomorrow from our Queens warehouse.</p>
      </div>

      <ol className="order__tl">
        <li className="is-done"><span>✓</span><b>Order placed</b><em>{order.placed}</em></li>
        <li className="is-done"><span>✓</span><b>Payment captured</b><em>{order.placed}</em></li>
        <li className="is-now"><span>•</span><b>Packing in Queens, NY</b><em>Today</em></li>
        <li><span>·</span><b>Picked up by UPS</b><em>Est. {order.ship}</em></li>
        <li><span>·</span><b>Delivered</b><em>2–4 business days</em></li>
      </ol>

      <div className="order__grid">
        <section>
          <h3 className="eyebrow eyebrow--gold" style={{ marginBottom: 12 }}>Your pieces</h3>
          {lines.map((x) => (
            <div key={x.id} className="order__line">
              <div className="order__lthumb"><img className="order__limg" src={x.product.img} alt={x.product.name} /></div>
              <div>
                <div className="order__lbrand">{BRANDS[x.product.brand].name}</div>
                <div className="order__lname">{x.product.name}{x.product.colorway && ", " + x.product.colorway}</div>
                <div className="order__lmeta">Size {x.size} · Qty 1</div>
              </div>
              <div className="order__lprice">
                <b>US$ {x.product.us}</b>
                <em>Duties incl.</em>
              </div>
            </div>
          ))}
        </section>
        <aside className="order__sum">
          <h3 className="eyebrow eyebrow--gold" style={{ marginBottom: 8 }}>Summary</h3>
          <div className="order__row"><span>Subtotal</span><b>US$ {subtotal}</b></div>
          <div className="order__row"><span>Duties &amp; import</span><b>Included</b></div>
          <div className="order__row"><span>U.S. shipping</span><b>{shipping === 0 ? "Free" : "US$ " + shipping}</b></div>
          <hr />
          <div className="order__row order__row--tot"><span>Total charged</span><b>US$ {subtotal + shipping}</b></div>
          <div className="order__ship">
            <div className="eyebrow eyebrow--gold">Ship to</div>
            <p>{order.address}</p>
          </div>
          <Btn variant="ghost" onClick={() => go({ name: "home" })}>Back to Chariot</Btn>
        </aside>
      </div>
    </main>
  );
}

// ───────────────────────── CART ─────────────────────────
function CartDrawer({ cart, go }) {
  if (!cart.open) return null;

  return (
    <div className="drawer-root" role="dialog" aria-label="Your bag">
      <div className="drawer-scrim" onClick={() => cart.setOpen(false)} />
      <aside className="drawer">
        <div className="drawer__head">
          <div className="drawer__title">Your bag {cart.count > 0 && <span>· {cart.count}</span>}</div>
          <button className="drawer__close" onClick={() => cart.setOpen(false)} aria-label="Close bag">×</button>
        </div>
        {cart.items.length === 0 ? (
          <div className="drawer__empty">
            <p>Your bag is empty.</p>
            <Btn variant="ghost" onClick={() => { cart.setOpen(false); go({ name: "shop", segment: "available" }); }}>Shop available</Btn>
          </div>
        ) : (
          <>
            <ul className="drawer__list">
              {cart.items.map((x) => (
                <li key={x.id + x.size} className="drawer__item">
                  <div className="drawer__thumb"><img src={x.product.img} alt={x.product.name} /></div>
                  <div className="drawer__body">
                    <div className="drawer__brand">{BRANDS[x.product.brand].name}</div>
                    <div className="drawer__name">{x.product.name}{x.product.colorway && <>, {x.product.colorway}</>}</div>
                    <div className="drawer__meta">Size {x.size} · Qty {x.qty}</div>
                  </div>
                  <div className="drawer__price">
                    <b>US$ {x.product.us * x.qty}</b>
                    <button className="linkbtn" onClick={() => cart.remove(x.id, x.size)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="drawer__sum">
              <div className="drawer__row"><span>Subtotal</span><b>US$ {cart.subtotal}</b></div>
              <div className="drawer__row"><span>Duties &amp; import</span><b>Included</b></div>
              <div className="drawer__row"><span>U.S. shipping</span><b>{cart.subtotal >= 150 ? "Free" : "US$ 12"}</b></div>
            </div>

            <div className="drawer__cta">
              <Btn variant="primary" onClick={() => { cart.setOpen(false); go({ name: "order", id: "CHR-21078" }); }}>
                Checkout · US$ {cart.subtotal + (cart.subtotal >= 150 ? 0 : 12)}
              </Btn>
              <button className="linkbtn" onClick={() => cart.setOpen(false)}>Continue shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

Object.assign(window, { HomePage, ShopPage, BrandPage, ProductPage, AboutPage, OrderPage, CartDrawer });
