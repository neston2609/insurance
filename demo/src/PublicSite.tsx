import {
  ArrowRight,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "./lib/api";

type Product = {
  productId: string;
  slug: string;
  productName: string;
  productType: string;
  vehicleType: string;
  insuranceClass: string;
  shortDescription: string;
  description: string;
  insurerName: string;
  startingPremium: number;
  coverage: Record<string, boolean>;
  coverageLimits: Record<string, string>;
  features: string[];
  terms: string[];
  active: boolean;
  featured: boolean;
  minVehicleAge: number;
  maxVehicleAge: number;
};
const money = (value: number) => new Intl.NumberFormat("th-TH").format(value);
const coverageLabels: Record<string, string> = {
  thirdPartyProperty: "ทรัพย์สินบุคคลภายนอก",
  thirdPartyInjury: "ชีวิตและร่างกายบุคคลภายนอก",
  ownVehicleCollision: "รถชน/รถพลิกคว่ำ",
  vehicleTheft: "รถสูญหาย",
  fire: "ไฟไหม้",
  flood: "น้ำท่วม",
  personalAccident: "อุบัติเหตุส่วนบุคคล",
  medicalExpense: "ค่ารักษาพยาบาล",
  driverBail: "ประกันตัวผู้ขับขี่",
};

export function PublicSite() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const path = window.location.pathname;
  useEffect(() => {
    api<{ items: Product[] }>("/api/public/products")
      .then((data) => setProducts(data.items))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);
  const detail = path.startsWith("/products/")
    ? products.find(
        (item) => item.slug === decodeURIComponent(path.split("/")[2]),
      )
    : undefined;
  const active =
    path === "/"
      ? "home"
      : path.startsWith("/products")
        ? "products"
        : path.startsWith("/recommend")
          ? "recommend"
          : "contact";
  return (
    <div className="public-site">
      <header className="public-header">
        <div className="public-header-inner">
          <a href="/" className="public-brand">
            <span className="brand-mark">
              <ShieldCheck size={23} />
            </span>
            <span>
              MFEC <b>Insurrance</b>
            </span>
          </a>
          <button
            className="mobile-menu"
            type="button"
            aria-label="เปิดเมนู"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav className={menuOpen ? "public-nav open" : "public-nav"}>
            <a className={active === "home" ? "active" : ""} href="/">
              หน้าหลัก
            </a>
            <a
              className={active === "products" ? "active" : ""}
              href="/products"
            >
              แบบประกัน
            </a>
            <a
              className={active === "recommend" ? "active" : ""}
              href="/recommend"
            >
              แนะนำแผน
            </a>
            <a className={active === "contact" ? "active" : ""} href="/contact">
              ติดต่อเรา
            </a>
          </nav>
          <a className="public-header-cta" href="/contact">
            ให้เราติดต่อกลับ <ArrowRight size={16} />
          </a>
        </div>
      </header>
      {error && (
        <div className="public-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="public-loading">กำลังโหลดข้อมูล...</div>
      ) : path === "/" ? (
        <Home products={products} />
      ) : path === "/products" ? (
        <Catalog products={products} />
      ) : path.startsWith("/products/") ? (
        detail ? (
          <Detail product={detail} />
        ) : (
          <NotFound />
        )
      ) : path === "/recommend" ? (
        <Recommend products={products} />
      ) : path === "/contact" ? (
        <Contact products={products} />
      ) : (
        <NotFound />
      )}
      <footer className="public-footer">
        <div className="public-container footer-grid">
          <div>
            <div className="footer-logo">
              MFEC <b>Insurrance</b>
            </div>
            <p>
              ทางเลือกประกันภัยรถยนต์และรถจักรยานยนต์ที่เข้าใจง่าย
              เพื่อให้คุณเลือกความคุ้มครองได้มั่นใจ
            </p>
          </div>
          <div>
            <b>สำรวจ</b>
            <a href="/products">แบบประกันทั้งหมด</a>
            <a href="/recommend">ค้นหาแผนที่ใช่</a>
            <a href="/contact">ติดต่อเรา</a>
          </div>
          <div>
            <b>ข้อมูลสำคัญ</b>
            <p>
              เว็บไซต์นี้เป็นระบบสาธิต ข้อมูลสินค้า ราคา
              และความคุ้มครองเป็นตัวอย่าง ไม่ใช่ข้อเสนอหรือกรมธรรม์จริง
            </p>
          </div>
        </div>
        <div className="footer-bottom public-container">
          © {new Date().getFullYear()} MFEC Insurrance · Demo application
        </div>
      </footer>
    </div>
  );
}

function Home({ products }: { products: Product[] }) {
  const featured = products.filter((item) => item.featured).slice(0, 3);
  return (
    <>
      <section className="public-hero">
        <div className="public-container hero-content">
          <div className="hero-copy">
            <span className="hero-kicker">ประกันภัยที่ไปกับคุณทุกเส้นทาง</span>
            <h1>
              ขับไปข้างหน้า
              <br />
              <span>อย่างมั่นใจ</span>
            </h1>
            <p>
              เลือกความคุ้มครองรถยนต์และมอเตอร์ไซค์ให้เหมาะกับชีวิตคุณ
              เปรียบเทียบง่าย ตัดสินใจได้ด้วยข้อมูลที่ชัดเจน
            </p>
            <div className="hero-actions">
              <a className="button button-red" href="/products">
                ดูแบบประกัน <ArrowRight size={18} />
              </a>
              <a className="button button-light" href="/recommend">
                ให้เราช่วยเลือก
              </a>
            </div>
          </div>
        </div>
        <div className="hero-photo-credit">MFEC Insurrance Demo</div>
      </section>
      <section className="public-trust">
        <div className="public-container trust-grid">
          <div>
            <ShieldCheck />
            <span>
              <b>คุ้มครองครบ</b>
              <small>เลือกได้ตามการใช้งาน</small>
            </span>
          </div>
          <div>
            <SlidersHorizontal />
            <span>
              <b>เปรียบเทียบง่าย</b>
              <small>เห็นความต่างชัดเจน</small>
            </span>
          </div>
          <div>
            <Headphones />
            <span>
              <b>พร้อมช่วยเหลือ</b>
              <small>ขอให้ติดต่อกลับได้ทันที</small>
            </span>
          </div>
        </div>
      </section>
      <section className="public-section public-container">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">แผนที่ได้รับความสนใจ</span>
            <h2>คุ้มครองที่เลือกได้</h2>
            <p>ดูรายละเอียดก่อนเลือกแผนที่เหมาะกับรถและงบประมาณของคุณ</p>
          </div>
          <a className="text-link" href="/products">
            ดูทั้งหมด <ArrowRight size={17} />
          </a>
        </div>
        <div className="product-grid">
          {featured.map((item) => (
            <ProductCard key={item.productId} product={item} />
          ))}
        </div>
      </section>
      <section className="public-band">
        <div className="public-container band-grid">
          <div>
            <span className="section-eyebrow">เลือกไม่ถูก?</span>
            <h2>เริ่มจากสิ่งที่คุณต้องการ</h2>
            <p>
              ตอบคำถามสั้น ๆ เกี่ยวกับรถ การใช้งาน และงบประมาณ
              เพื่อดูแผนที่น่าสนใจ
            </p>
            <a className="button button-white" href="/recommend">
              ค้นหาแผนแนะนำ <ArrowRight size={18} />
            </a>
          </div>
          <div className="band-steps">
            <div>
              <b>01</b>
              <span>บอกรายละเอียดรถ</span>
            </div>
            <div>
              <b>02</b>
              <span>เลือกความคุ้มครอง</span>
            </div>
            <div>
              <b>03</b>
              <span>ดูแผนที่เหมาะกับคุณ</span>
            </div>
          </div>
        </div>
      </section>
      <section className="public-section public-container">
        <div className="section-head">
          <div>
            <span className="section-eyebrow">คำถามที่พบบ่อย</span>
            <h2>รู้ก่อนเลือก ประกันที่ใช่</h2>
          </div>
        </div>
        <Faq />
      </section>
    </>
  );
}

function ProductCard({
  product,
  selected,
  onToggle,
}: {
  product: Product;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <article className="product-card">
      <div className="product-card-top">
        <span className="product-icon">
          <CarFront size={26} />
        </span>
        <span className="product-class">{product.insuranceClass}</span>
      </div>
      <div>
        <span className="product-type">
          {product.vehicleType === "MOTORCYCLE"
            ? "รถจักรยานยนต์"
            : product.vehicleType === "ADDON"
              ? "ความคุ้มครองเสริม"
              : "รถยนต์"}
        </span>
        <h3>{product.productName}</h3>
        <p>{product.shortDescription}</p>
      </div>
      <div className="product-card-bottom">
        <div>
          <small>เริ่มต้น</small>
          <strong>
            ฿{money(product.startingPremium)}
            <em> / ปี</em>
          </strong>
        </div>
        <a
          href={`/products/${product.slug}`}
          aria-label={`ดูรายละเอียด ${product.productName}`}
        >
          <ArrowRight size={21} />
        </a>
      </div>
      {onToggle && (
        <label className="compare-check">
          <input type="checkbox" checked={selected} onChange={onToggle} />{" "}
          เปรียบเทียบแผนนี้
        </label>
      )}
    </article>
  );
}

function Catalog({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [tier, setTier] = useState("ALL");
  const [sort, setSort] = useState("display");
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const visible = useMemo(
    () =>
      products
        .filter(
          (item) =>
            (type === "ALL" || item.vehicleType === type) &&
            (tier === "ALL" || item.insuranceClass === tier) &&
            (!search ||
              [item.productName, item.shortDescription, item.insurerName]
                .join(" ")
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase())),
        )
        .sort((a, b) =>
          sort === "price-asc"
            ? a.startingPremium - b.startingPremium
            : sort === "price-desc"
              ? b.startingPremium - a.startingPremium
              : 0,
        ),
    [products, search, type, tier, sort],
  );
  const classes = [...new Set(products.map((item) => item.insuranceClass))];
  return (
    <>
      <div className="public-page-head">
        <div className="public-container">
          <span className="section-eyebrow">แบบประกันทั้งหมด</span>
          <h1>ความคุ้มครองที่เหมาะกับคุณ</h1>
          <p>เปรียบเทียบตัวเลือกและค้นหาแผนที่ตรงกับการใช้งาน</p>
        </div>
      </div>
      <main className="public-section public-container">
        <div className="catalog-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="ค้นหาแบบประกัน"
              placeholder="ค้นหาชื่อแผนหรือบริษัทประกัน"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label="ประเภทรถ"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="ALL">ประเภทรถทั้งหมด</option>
            <option value="CAR">รถยนต์</option>
            <option value="MOTORCYCLE">รถจักรยานยนต์</option>
            <option value="ADDON">ความคุ้มครองเสริม</option>
          </select>
          <select
            aria-label="ชั้นประกัน"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          >
            <option value="ALL">ทุกประเภทความคุ้มครอง</option>
            {classes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="display">แนะนำ</option>
            <option value="price-asc">ราคา: น้อยไปมาก</option>
            <option value="price-desc">ราคา: มากไปน้อย</option>
          </select>
        </div>
        <div className="catalog-count">พบ {visible.length} แผน</div>
        <div className="product-grid">
          {visible.map((item) => (
            <ProductCard
              key={item.productId}
              product={item}
              selected={selected.includes(item.productId)}
              onToggle={() =>
                setSelected((current) =>
                  current.includes(item.productId)
                    ? current.filter((id) => id !== item.productId)
                    : current.length < 3
                      ? [...current, item.productId]
                      : current,
                )
              }
            />
          ))}
        </div>
        {!visible.length && (
          <div className="empty-state">ไม่พบแผนที่ตรงกับการค้นหา</div>
        )}
      </main>
      {selected.length >= 2 && (
        <div className="compare-bar">
          <span>เลือกแล้ว {selected.length} แผน</span>
          <button
            className="button button-red"
            onClick={() => setComparing(true)}
          >
            เปรียบเทียบ <ArrowRight size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="ล้างการเลือก"
            onClick={() => setSelected([])}
          >
            <X />
          </button>
        </div>
      )}
      {comparing && (
        <div className="modal-backdrop" onClick={() => setComparing(false)}>
          <div
            className="compare-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2>เปรียบเทียบแผน</h2>
              <button
                className="icon-button"
                aria-label="ปิด"
                onClick={() => setComparing(false)}
              >
                <X />
              </button>
            </div>
            <div className="compare-scroll">
              <table>
                <thead>
                  <tr>
                    <th>รายละเอียด</th>
                    {products
                      .filter((item) => selected.includes(item.productId))
                      .map((item) => (
                        <th key={item.productId}>
                          <a href={`/products/${item.slug}`}>
                            {item.productName}
                          </a>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>เบี้ยเริ่มต้น</td>
                    {products
                      .filter((item) => selected.includes(item.productId))
                      .map((item) => (
                        <td key={item.productId}>
                          ฿{money(item.startingPremium)}
                        </td>
                      ))}
                  </tr>
                  {Object.entries(coverageLabels).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {products
                        .filter((item) => selected.includes(item.productId))
                        .map((item) => (
                          <td key={item.productId}>
                            {item.coverage[key] ? (
                              <Check className="yes" size={18} />
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Detail({ product }: { product: Product }) {
  return (
    <>
      <div className="public-page-head detail-head">
        <div className="public-container">
          <a className="back-link" href="/products">
            <ChevronLeft size={16} /> แบบประกันทั้งหมด
          </a>
          <span className="section-eyebrow">
            {product.insuranceClass} · {product.insurerName}
          </span>
          <h1>{product.productName}</h1>
          <p>{product.shortDescription}</p>
        </div>
      </div>
      <main className="public-container detail-layout">
        <div>
          <section>
            <h2>เกี่ยวกับแผนนี้</h2>
            <p>{product.description}</p>
          </section>
          <section>
            <h2>ความคุ้มครอง</h2>
            <div className="coverage-grid">
              {Object.entries(coverageLabels).map(([key, label]) => (
                <div
                  key={key}
                  className={
                    product.coverage[key]
                      ? "coverage-item covered"
                      : "coverage-item"
                  }
                >
                  <span>
                    {product.coverage[key] ? (
                      <Check size={16} />
                    ) : (
                      <X size={15} />
                    )}
                  </span>
                  <div>
                    <b>{label}</b>
                    {product.coverageLimits[key] && (
                      <small>{product.coverageLimits[key]}</small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>จุดเด่น</h2>
            <ul className="detail-list">
              {product.features.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>เงื่อนไขสำคัญ</h2>
            <ul className="detail-terms">
              {product.terms.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="detail-aside">
          <span>เบี้ยประกันเริ่มต้น</span>
          <strong>
            ฿{money(product.startingPremium)}
            <small> / ปี</small>
          </strong>
          <p>ราคาจริงขึ้นอยู่กับข้อมูลรถและเงื่อนไขการรับประกัน</p>
          <a
            className="button button-red"
            href={`/contact?product=${product.productId}`}
          >
            ขอให้ติดต่อกลับ <ArrowRight size={17} />
          </a>
          <a className="button button-outline" href="/products">
            ดูแผนอื่น
          </a>
        </aside>
      </main>
    </>
  );
}

function Recommend({ products }: { products: Product[] }) {
  const [step, setStep] = useState(0);
  const [vehicleType, setVehicleType] = useState("CAR");
  const [age, setAge] = useState(3);
  const [budget, setBudget] = useState(15000);
  const [priority, setPriority] = useState("balanced");
  const matches = useMemo(
    () =>
      products
        .filter(
          (item) =>
            item.vehicleType === vehicleType &&
            age >= item.minVehicleAge &&
            age <= item.maxVehicleAge,
        )
        .sort((a, b) => {
          const score = (p: Product) =>
            Math.abs(p.startingPremium - budget) +
            (priority === "coverage" && p.coverage.ownVehicleCollision
              ? -5000
              : 0) +
            (priority === "budget" ? p.startingPremium : 0);
          return score(a) - score(b);
        })
        .slice(0, 3),
    [products, vehicleType, age, budget, priority],
  );
  return (
    <>
      <div className="public-page-head">
        <div className="public-container">
          <span className="section-eyebrow">ตัวช่วยเลือกแผน</span>
          <h1>หาแผนที่เข้ากับคุณ</h1>
          <p>ตอบคำถามไม่กี่ข้อ แล้วดูตัวเลือกที่ตรงกับความต้องการ</p>
        </div>
      </div>
      <main className="public-container wizard-wrap">
        <div className="wizard-progress">
          <span>ขั้นตอน {Math.min(step + 1, 4)} / 4</span>
          <div>
            <i style={{ width: `${(Math.min(step + 1, 4) / 4) * 100}%` }} />
          </div>
        </div>
        {step === 0 ? (
          <section className="wizard-panel">
            <CarFront size={32} />
            <h2>คุณใช้รถประเภทไหน?</h2>
            <div className="choice-grid">
              <button
                className={vehicleType === "CAR" ? "choice active" : "choice"}
                onClick={() => setVehicleType("CAR")}
              >
                รถยนต์
              </button>
              <button
                className={
                  vehicleType === "MOTORCYCLE" ? "choice active" : "choice"
                }
                onClick={() => setVehicleType("MOTORCYCLE")}
              >
                รถจักรยานยนต์
              </button>
            </div>
          </section>
        ) : step === 1 ? (
          <section className="wizard-panel">
            <h2>รถของคุณอายุประมาณกี่ปี?</h2>
            <label className="range-label">
              <input
                type="range"
                min="0"
                max="20"
                value={age}
                onChange={(event) => setAge(Number(event.target.value))}
              />
              <strong>{age} ปี</strong>
            </label>
          </section>
        ) : step === 2 ? (
          <section className="wizard-panel">
            <h2>อะไรสำคัญกับคุณที่สุด?</h2>
            <div className="choice-grid">
              <button
                className={priority === "coverage" ? "choice active" : "choice"}
                onClick={() => setPriority("coverage")}
              >
                ความคุ้มครองครอบคลุม
              </button>
              <button
                className={priority === "balanced" ? "choice active" : "choice"}
                onClick={() => setPriority("balanced")}
              >
                สมดุลราคาและความคุ้มครอง
              </button>
              <button
                className={priority === "budget" ? "choice active" : "choice"}
                onClick={() => setPriority("budget")}
              >
                ประหยัดงบ
              </button>
            </div>
            <label className="range-label">
              งบประมาณต่อปี{" "}
              <input
                type="range"
                min="2000"
                max="35000"
                step="1000"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
              />
              <strong>฿{money(budget)}</strong>
            </label>
          </section>
        ) : (
          <section className="wizard-results">
            <span className="section-eyebrow">ผลการแนะนำ</span>
            <h2>แผนที่น่าสนใจสำหรับคุณ</h2>
            <p>
              ผลลัพธ์ใช้ข้อมูลเบื้องต้นเพื่อช่วยเปรียบเทียบ
              โปรดตรวจสอบเงื่อนไขจริงกับผู้ให้บริการ
            </p>
            <div className="product-grid">
              {matches.map((item) => (
                <ProductCard key={item.productId} product={item} />
              ))}
            </div>
            {!matches.length && (
              <div className="empty-state">
                ยังไม่มีแผนตรงกับข้อมูล ลองปรับอายุรถหรือประเภทอีกครั้ง
              </div>
            )}
          </section>
        )}
        <div className="wizard-actions">
          {step > 0 && (
            <button
              className="button button-outline"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={17} /> ย้อนกลับ
            </button>
          )}
          {step < 3 && (
            <button
              className="button button-red"
              onClick={() => setStep(step + 1)}
            >
              ถัดไป <ChevronRight size={17} />
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function Contact({ products }: { products: Product[] }) {
  const preselected =
    new URLSearchParams(window.location.search).get("product") || "";
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    productId: preselected,
    preferredChannel: "VOICE",
    preferredContactTime: "",
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ inquiryId: string }>("/api/public/inquiries", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setDone(result.inquiryId);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ไม่สามารถส่งข้อมูลได้",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="public-page-head">
        <div className="public-container">
          <span className="section-eyebrow">พูดคุยกับเรา</span>
          <h1>ให้เราติดต่อกลับ</h1>
          <p>ฝากข้อมูลไว้ ทีมงานจะติดต่อกลับตามช่วงเวลาที่คุณสะดวก</p>
        </div>
      </div>
      <main className="public-container contact-layout">
        <div>
          <h2>เริ่มต้นง่าย ๆ</h2>
          <p>
            ระบุแบบประกันที่สนใจและช่องทางการติดต่อ
            ทีมงานจะช่วยตอบข้อสงสัยเรื่องความคุ้มครองและเงื่อนไข
          </p>
          <div className="contact-benefit">
            <Headphones />
            <span>เลือกช่วงเวลาที่สะดวกได้</span>
          </div>
          <div className="contact-benefit">
            <ClipboardCheck />
            <span>ข้อมูลของคุณใช้เพื่อการติดต่อกลับเท่านั้น</span>
          </div>
          <div className="demo-note">
            MFEC Insurrance เป็นระบบสาธิต ไม่มีการออกกรมธรรม์หรือเสนอขายจริง
          </div>
        </div>
        <div className="contact-form-wrap">
          {done ? (
            <div className="success-state">
              <ShieldCheck size={44} />
              <h2>รับข้อมูลเรียบร้อย</h2>
              <p>หมายเลขคำขอ {done} ขอบคุณที่สนใจ</p>
              <a className="button button-red" href="/products">
                ดูแบบประกันเพิ่มเติม <ArrowRight size={17} />
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2>ข้อมูลสำหรับติดต่อกลับ</h2>
              <div className="form-row">
                <label>
                  ชื่อ
                  <input
                    required
                    value={form.firstName}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                  />
                </label>
                <label>
                  นามสกุล
                  <input
                    required
                    value={form.lastName}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                เบอร์โทรศัพท์
                <input
                  required
                  type="tel"
                  placeholder="08xxxxxxxx"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </label>
              <label>
                แบบประกันที่สนใจ
                <select
                  required
                  value={form.productId}
                  onChange={(event) =>
                    setForm({ ...form, productId: event.target.value })
                  }
                >
                  <option value="">เลือกแบบประกัน</option>
                  {products.map((item) => (
                    <option key={item.productId} value={item.productId}>
                      {item.productName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  ช่องทางที่สะดวก
                  <select
                    value={form.preferredChannel}
                    onChange={(event) =>
                      setForm({ ...form, preferredChannel: event.target.value })
                    }
                  >
                    <option value="VOICE">โทรศัพท์</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">อีเมล</option>
                    <option value="LINE">LINE</option>
                  </select>
                </label>
                <label>
                  ช่วงเวลาที่สะดวก
                  <input
                    required
                    placeholder="เช่น จันทร์–ศุกร์ 10:00–12:00"
                    value={form.preferredContactTime}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        preferredContactTime: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label className="consent">
                <input
                  required
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) =>
                    setForm({ ...form, consent: event.target.checked })
                  }
                />{" "}
                ยินยอมให้ใช้ข้อมูลนี้เพื่อติดต่อกลับเกี่ยวกับแบบประกันที่สนใจ
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-red submit" disabled={busy}>
                {busy ? "กำลังส่ง..." : "ส่งคำขอ"} <ArrowRight size={17} />
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

function Faq() {
  return (
    <div className="faq-list">
      {[
        [
          "จะทราบเบี้ยประกันที่แน่นอนได้อย่างไร?",
          "เบี้ยจริงขึ้นอยู่กับข้อมูลรถ อายุรถ ประวัติการใช้งาน และเงื่อนไขบริษัทประกัน กรุณาฝากข้อมูลเพื่อให้ทีมงานติดต่อกลับ",
        ],
        [
          "ประกันชั้น 1 กับ 2+ ต่างกันอย่างไร?",
          "โดยทั่วไปชั้น 1 ครอบคลุมอุบัติเหตุรถชนได้กว้างกว่า ส่วน 2+ เน้นความคุ้มครองเมื่อมีคู่กรณีเป็นยานพาหนะ โปรดดูรายละเอียดรายแผน",
        ],
        [
          "เว็บไซต์นี้ซื้อประกันได้เลยหรือไม่?",
          "ไม่ได้ เว็บไซต์นี้เป็นระบบสาธิตสำหรับนำเสนอข้อมูลและรับคำขอติดต่อกลับเท่านั้น",
        ],
      ].map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <ChevronDown size={18} />
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
function NotFound() {
  return (
    <main className="public-container not-found">
      <h1>ไม่พบหน้านี้</h1>
      <p>ลองกลับไปดูแบบประกันทั้งหมด</p>
      <a className="button button-red" href="/products">
        ดูแบบประกัน <ArrowRight size={17} />
      </a>
    </main>
  );
}
