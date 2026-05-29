/* global React, PRODUCTS, BRANDS, TopBar, Header, Footer, HomePage, ShopPage, BrandPage, ProductPage, AboutPage, OrderPage, CartDrawer */
const { useState, useEffect, useCallback } = React;

function useRoute() {
  const parse = () => {
    const h = window.location.hash.replace(/^#\/?/, "");
    if (!h) return { name: "home" };
    const [a, b] = h.split("/");
    if (a === "shop")    return { name: "shop", segment: b || "all" };
    if (a === "brand")   return { name: "brand", slug: b };
    if (a === "product") return { name: "product", id: b };
    if (a === "about")   return { name: "about" };
    if (a === "order")   return { name: "order", id: b };
    return { name: "home" };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((r) => {
    const path =
      r.name === "home"    ? "" :
      r.name === "shop"    ? "shop/" + (r.segment || "all") :
      r.name === "brand"   ? "brand/" + r.slug :
      r.name === "product" ? "product/" + r.id :
      r.name === "about"   ? "about" :
      r.name === "order"   ? "order/" + r.id : "";
    window.location.hash = "#/" + path;
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}

function useCart() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const add = useCallback((p, size) => {
    setItems((xs) => {
      const hit = xs.find((x) => x.id === p.id && x.size === size);
      if (hit) return xs.map((x) => (x === hit ? { ...x, qty: x.qty + 1 } : x));
      return [...xs, { id: p.id, size, qty: 1, product: p }];
    });
    setOpen(true);
  }, []);
  const remove = useCallback((id, size) => setItems((xs) => xs.filter((x) => !(x.id === id && x.size === size))), []);
  const count = items.reduce((s, x) => s + x.qty, 0);
  const subtotal = items.reduce((s, x) => s + x.qty * x.product.us, 0);
  return { items, open, setOpen, add, remove, count, subtotal };
}

function App() {
  const [route, go] = useRoute();
  const cart = useCart();
  const [overVideo, setHeaderOverVideo] = useState(false);

  let content;
  if (route.name === "home")       content = <HomePage go={go} setHeaderOverVideo={setHeaderOverVideo} />;
  else if (route.name === "shop")  content = <ShopPage go={go} segment={route.segment} />;
  else if (route.name === "brand") {
    const b = BRANDS[route.slug];
    content = b ? <BrandPage brand={b} go={go} setHeaderOverVideo={setHeaderOverVideo} /> : <NotFound go={go} />;
  }
  else if (route.name === "product") {
    const p = PRODUCTS.find((x) => x.id === route.id);
    content = p ? <ProductPage product={p} brand={BRANDS[p.brand]} go={go} cart={cart} /> : <NotFound go={go} />;
  }
  else if (route.name === "about") content = <AboutPage />;
  else if (route.name === "order") content = <OrderPage id={route.id} go={go} />;
  else content = <NotFound go={go} />;

  return (
    <div className="site">
      <TopBar />
      <Header route={route} go={go} cart={cart} overVideo={overVideo} />
      {content}
      <Footer go={go} />
      <CartDrawer cart={cart} go={go} />
    </div>
  );
}

function NotFound({ go }) {
  return (
    <section className="section section--narrow">
      <div className="eyebrow eyebrow--gold">404</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "48px", letterSpacing: "-0.02em", margin: "14px 0 24px" }}>This page isn't in the drop.</h1>
      <button className="btn btn--ghost" onClick={() => go({ name: "home" })}>Back to home</button>
    </section>
  );
}

Object.assign(window, { App, useRoute, useCart });
