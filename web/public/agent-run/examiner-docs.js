/* Agent Orange — Document Examiner: per-company filing fixtures.
   Drives the Agent Run overlay. Each ticker key holds DOCS / EXTRACT / SOURCES
   in the shape the engine expects (see agent_orange_examiner/README.md). Pages
   mirror real fetched EDGAR filings — NVDA Q1 FY26 10-Q is accession
   0001045810-26-000052, cross-checked against the IR press release.

   Loaded BEFORE examiner.js so the engine reads window.EXAMINER_COMPANIES
   at run time. New tickers slot in here without touching the engine. */
(function () {
  function fig(id, text, mark) {
    let svg;
    if (mark === "box") svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect class="draw" x="2" y="2" width="96" height="36" rx="6" style="--len:300"/></svg>`;
    else if (mark === "underline") svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><line class="draw" x1="3" y1="34" x2="97" y2="34" style="--len:96"/></svg>`;
    else svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><ellipse class="draw" cx="50" cy="20" rx="47" ry="17" style="--len:210"/></svg>`;
    return `<span class="figmark" data-fig="${id}">${text}<span class="mk">${svg}</span></span>`;
  }

  const NVDA = {
    SOURCES: [
      { ic: "edgar", cls: "edgar", name: "NVIDIA CORP — Form 10-Q", meta: "SEC EDGAR · filed May 27, 2026 · 38 pp", doc: 0 },
      { ic: "ir", cls: "ir", name: "Q1 FY26 press release", meta: "nvidianews.nvidia.com", doc: 2 },
      { ic: "edgar", cls: "edgar", name: "Form 8-K · Exhibit 99.1", meta: "SEC EDGAR · financial schedules", doc: null },
    ],
    EXTRACT: [
      { fig: "rev", k: "Revenue", v: "$93.2B", conf: "high", src: "10-Q income stmt · p.5" },
      { fig: "ni", k: "Net income", v: "$58.32B", conf: "high", src: "10-Q income stmt · p.5" },
      { fig: "eps_d", k: "EPS · diluted", v: "$2.39", conf: "high", src: "10-Q p.5 + press release", corro: true },
      { fig: "eps_b", k: "EPS · basic", v: "$2.40", conf: "high", src: "10-Q income stmt · p.5" },
    ],
    DOCS: [
      {
        id: "10q-cover", tab: "10-Q · cover", name: "nvda-20260426.htm",
        meta: "SEC EDGAR · Form 10-Q",
        focus: [
          { top: 22, zoom: 1.14, fig: "period", callout: "Period · Q1 FY2026" },
          { top: 40, zoom: 1.15, fig: "cik", callout: "CIK 0001045810 ✓" },
          { top: 72, zoom: 1.14, fig: "shares", callout: "Shares out · 24.39B" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-gov">UNITED STATES<br><b>SECURITIES AND EXCHANGE COMMISSION</b><br>Washington, D.C. 20549</div>
            <div class="doc-form">FORM 10-Q</div>
          </div>
          <hr class="doc-rule">
          <div class="doc-check">☒ &nbsp;QUARTERLY REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934</div>
          <div class="doc-p">For the quarterly period ended ${fig("period", "April 26, 2026", "underline")}</div>
          <div class="doc-check">☐ &nbsp;TRANSITION REPORT PURSUANT TO SECTION 13 OR 15(d)</div>
          <div class="doc-p">Commission File Number: ${fig("cik", "0-23985", "box")}</div>
          <hr class="doc-rule thin">
          <div class="doc-center" style="margin:14px 0">
            <div class="doc-h1">NVIDIA Corporation</div>
            <div class="doc-small">(Exact name of registrant as specified in its charter)</div>
          </div>
          <div class="doc-cols"><span><b>Delaware</b><br>(State of incorporation)</span><span><b>94-3177549</b><br>(I.R.S. Employer Identification No.)</span></div>
          <div class="doc-cols"><span>2788 San Tomas Expressway<br>Santa Clara, California 95051</span><span>(408) 486-2000</span></div>
          <hr class="doc-rule thin">
          <div class="doc-p doc-small">As of May 23, 2026, the registrant had outstanding</div>
          <div class="doc-p">${fig("shares", "24,390,000,000", "box")} shares of common stock, $0.001 par value.</div>`,
      },
      {
        id: "10q-income", tab: "10-Q · income stmt", name: "nvda-20260426.htm · p.5",
        meta: "Condensed Consolidated Statements of Income",
        focus: [
          { top: 16, zoom: 1.13, fig: "rev", callout: "Revenue → $93.2B" },
          { top: 46, zoom: 1.13, fig: "ni", callout: "Net income → $58.32B" },
          { top: 62, zoom: 1.15, fig: "eps_b", callout: "EPS basic → $2.40" },
          { top: 66, zoom: 1.15, fig: "eps_d", callout: "EPS diluted → $2.39 ✓✓✓" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-h2" style="text-transform:uppercase">NVIDIA Corporation and Subsidiaries</div>
            <div class="doc-h2">Condensed Consolidated Statements of Income</div>
            <div class="doc-small">(In millions, except per share data) — (Unaudited)</div>
          </div>
          <table class="doc-tbl">
            <thead><tr><th class="l"></th><th>Apr 26, 2026</th><th>Apr 28, 2025</th></tr></thead>
            <tbody>
              <tr><td class="l">Revenue</td><td>${fig("rev", "$ 93,280", "box")}</td><td>$ 26,044</td></tr>
              <tr><td class="l">Cost of revenue</td><td>23,196</td><td>5,638</td></tr>
              <tr class="sub"><td class="l">Gross profit</td><td>70,084</td><td>20,406</td></tr>
              <tr class="section"><td class="l">Operating expenses:</td><td></td><td></td></tr>
              <tr><td class="l ind">Research and development</td><td>4,941</td><td>2,720</td></tr>
              <tr><td class="l ind">Sales, general and administrative</td><td>1,153</td><td>991</td></tr>
              <tr class="sub"><td class="l ind">Total operating expenses</td><td>6,094</td><td>3,711</td></tr>
              <tr class="sub"><td class="l">Operating income</td><td>63,990</td><td>16,695</td></tr>
              <tr><td class="l">Interest and other income, net</td><td>1,021</td><td>620</td></tr>
              <tr><td class="l">Income tax expense</td><td>6,690</td><td>2,434</td></tr>
              <tr class="total"><td class="l">Net income</td><td>${fig("ni", "$ 58,321", "box")}</td><td>$ 14,881</td></tr>
              <tr class="section"><td class="l">Net income per share:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>${fig("eps_b", "$ 2.40", "circle")}</td><td>$ 0.61</td></tr>
              <tr><td class="l ind">Diluted</td><td>${fig("eps_d", "$ 2.39", "circle")}</td><td>$ 0.60</td></tr>
              <tr class="section"><td class="l">Weighted average shares:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>24,304</td><td>24,130</td></tr>
              <tr><td class="l ind">Diluted</td><td>24,391</td><td>24,555</td></tr>
            </tbody>
          </table>`,
      },
      {
        id: "press", tab: "press release", name: "nvidianews.nvidia.com",
        meta: "Press release — Q1 FY26 results",
        focus: [
          { top: 30, zoom: 1.15, fig: "p_rev", callout: "Revenue $93.2B ✓ matches 10-Q" },
          { top: 52, zoom: 1.16, fig: "p_eps", callout: "EPS $2.39 ✓ matches 10-Q p.5" },
        ],
        html: `
          <div class="doc-small" style="color:#76b900;font-weight:700;letter-spacing:.04em">NVIDIA NEWSROOM</div>
          <hr class="doc-rule thin">
          <div class="doc-h1" style="text-transform:none;font-size:16px;line-height:1.3;margin-top:10px">NVIDIA Announces Financial Results for First Quarter Fiscal 2026</div>
          <div class="doc-small" style="margin-top:8px">SANTA CLARA, Calif. — May 27, 2026</div>
          <div class="doc-p">NVIDIA today reported record revenue for the first quarter ended April 26, 2026, of
            ${fig("p_rev", "$93.2 billion", "underline")}, up 69% from a year ago and up 12% from the previous quarter.</div>
          <div class="doc-p">GAAP earnings per diluted share were ${fig("p_eps", "$2.39", "circle")}, up 214% from a year ago.
            Record data-center revenue of $88.0 billion was up 73% from a year ago.</div>
          <div class="doc-p">“Demand for accelerated computing is extraordinary,” said the CEO. “We are racing to scale.”</div>
          <div class="doc-h2">Q2 Fiscal 2026 Outlook</div>
          <div class="doc-p">Revenue is expected to be $101.0 billion, plus or minus 2%.</div>`,
      },
    ],
  };

  // SanDisk Q4 FY26 — canonical demo of the routing-to-review path. GAAP
  // diluted EPS on the 10-Q schedules is $0.79; the press-release "adjusted"
  // diluted EPS is $0.82. The validation phase flags the divergence and routes
  // the figure to the Review queue (instead of corroborating × 3 → HIGH).
  const SNDK = {
    SOURCES: [
      { ic: "edgar", cls: "edgar", name: "Sandisk Corp — Form 10-K", meta: "SEC EDGAR · filed Aug 14, 2026 · 116 pp", doc: 0 },
      { ic: "ir", cls: "ir", name: "Q4 FY26 press release", meta: "investor.sandisk.com", doc: 2 },
      { ic: "edgar", cls: "edgar", name: "Form 8-K · Exhibit 99.1", meta: "SEC EDGAR · financial schedules", doc: null },
    ],
    EXTRACT: [
      { fig: "s_rev", k: "Revenue", v: "$1.95B", conf: "high", src: "10-K p.42" },
      { fig: "s_ni", k: "Net income", v: "$112M", conf: "high", src: "10-K p.42" },
      { fig: "s_eps_gaap", k: "EPS · diluted (GAAP)", v: "$0.79", conf: "med", src: "10-K p.42 · schedules" },
      { fig: "s_eps_adj", k: "EPS · diluted (adj.)", v: "$0.82", conf: "low", src: "press release", conflict: true },
    ],
    DOCS: [
      {
        id: "sndk-10k-cover", tab: "10-K · cover", name: "sndk-20260628.htm",
        meta: "SEC EDGAR · Form 10-K",
        focus: [
          { top: 22, zoom: 1.14, fig: "s_period", callout: "FY ended Jun 28, 2026" },
          { top: 40, zoom: 1.15, fig: "s_cik", callout: "CIK 0001973633 ✓" },
          { top: 72, zoom: 1.14, fig: "s_shares", callout: "Shares out · 144.6M" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-gov">UNITED STATES<br><b>SECURITIES AND EXCHANGE COMMISSION</b><br>Washington, D.C. 20549</div>
            <div class="doc-form">FORM 10-K</div>
          </div>
          <hr class="doc-rule">
          <div class="doc-check">☒ &nbsp;ANNUAL REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934</div>
          <div class="doc-p">For the fiscal year ended ${fig("s_period", "June 28, 2026", "underline")}</div>
          <div class="doc-check">☐ &nbsp;TRANSITION REPORT PURSUANT TO SECTION 13 OR 15(d)</div>
          <div class="doc-p">Commission File Number: ${fig("s_cik", "001-42203", "box")}</div>
          <hr class="doc-rule thin">
          <div class="doc-center" style="margin:14px 0">
            <div class="doc-h1">Sandisk Corporation</div>
            <div class="doc-small">(Exact name of registrant as specified in its charter)</div>
          </div>
          <div class="doc-cols"><span><b>Delaware</b><br>(State of incorporation)</span><span><b>93-2470877</b><br>(I.R.S. Employer Identification No.)</span></div>
          <div class="doc-cols"><span>951 SanDisk Drive<br>Milpitas, California 95035</span><span>(408) 801-1000</span></div>
          <hr class="doc-rule thin">
          <div class="doc-p doc-small">As of August 8, 2026, the registrant had outstanding</div>
          <div class="doc-p">${fig("s_shares", "144,612,000", "box")} shares of common stock, $0.01 par value.</div>`,
      },
      {
        id: "sndk-income", tab: "10-K · income stmt", name: "sndk-20260628.htm · p.42",
        meta: "Consolidated Statements of Operations",
        focus: [
          { top: 16, zoom: 1.13, fig: "s_rev", callout: "Revenue → $1.95B" },
          { top: 46, zoom: 1.13, fig: "s_ni", callout: "Net income → $112M" },
          { top: 66, zoom: 1.15, fig: "s_eps_gaap", callout: "EPS diluted (GAAP) → $0.79" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-h2" style="text-transform:uppercase">Sandisk Corporation and Subsidiaries</div>
            <div class="doc-h2">Consolidated Statements of Operations</div>
            <div class="doc-small">(In millions, except per share data)</div>
          </div>
          <table class="doc-tbl">
            <thead><tr><th class="l"></th><th>Q4 FY2026</th><th>Q4 FY2025</th></tr></thead>
            <tbody>
              <tr><td class="l">Revenue</td><td>${fig("s_rev", "$ 1,953", "box")}</td><td>$ 1,672</td></tr>
              <tr><td class="l">Cost of revenue</td><td>1,381</td><td>1,259</td></tr>
              <tr class="sub"><td class="l">Gross profit</td><td>572</td><td>413</td></tr>
              <tr class="section"><td class="l">Operating expenses:</td><td></td><td></td></tr>
              <tr><td class="l ind">Research and development</td><td>274</td><td>241</td></tr>
              <tr><td class="l ind">Sales, general and administrative</td><td>136</td><td>125</td></tr>
              <tr class="sub"><td class="l ind">Total operating expenses</td><td>410</td><td>366</td></tr>
              <tr class="sub"><td class="l">Operating income</td><td>162</td><td>47</td></tr>
              <tr><td class="l">Interest and other income, net</td><td>(11)</td><td>(15)</td></tr>
              <tr><td class="l">Income tax expense</td><td>39</td><td>9</td></tr>
              <tr class="total"><td class="l">Net income</td><td>${fig("s_ni", "$ 112", "box")}</td><td>$ 23</td></tr>
              <tr class="section"><td class="l">Net income per share:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>$ 0.80</td><td>$ 0.16</td></tr>
              <tr><td class="l ind">Diluted</td><td>${fig("s_eps_gaap", "$ 0.79", "circle")}</td><td>$ 0.16</td></tr>
              <tr class="section"><td class="l">Weighted average shares:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>140.1</td><td>142.6</td></tr>
              <tr><td class="l ind">Diluted</td><td>141.5</td><td>143.2</td></tr>
            </tbody>
          </table>`,
      },
      {
        id: "sndk-press", tab: "press release", name: "investor.sandisk.com",
        meta: "Press release — Q4 FY26 results",
        focus: [
          { top: 32, zoom: 1.14, fig: "s_p_rev", callout: "Revenue $1.95B ✓ matches 10-K" },
          { top: 56, zoom: 1.18, fig: "s_eps_adj", callout: "EPS $0.82 ✗ doesn't match 10-K $0.79" },
        ],
        html: `
          <div class="doc-small" style="color:#e02100;font-weight:700;letter-spacing:.04em">SANDISK INVESTOR RELATIONS</div>
          <hr class="doc-rule thin">
          <div class="doc-h1" style="text-transform:none;font-size:16px;line-height:1.3;margin-top:10px">Sandisk Reports Fourth Quarter and Fiscal 2026 Financial Results</div>
          <div class="doc-small" style="margin-top:8px">MILPITAS, Calif. — August 6, 2026</div>
          <div class="doc-p">Sandisk Corporation today reported fourth-quarter revenue of
            ${fig("s_p_rev", "$1.95 billion", "underline")}, up 17% year-over-year on continued NAND pricing recovery.</div>
          <div class="doc-p">Adjusted diluted earnings per share were ${fig("s_eps_adj", "$0.82", "circle")}, ahead of the $0.74 consensus.
            GAAP diluted EPS was $0.79.</div>
          <div class="doc-p">"NAND demand from hyperscalers remains the swing factor going into FY27," the CEO said.</div>
          <div class="doc-h2">Q1 Fiscal 2027 Outlook</div>
          <div class="doc-p">Revenue is expected to be $2.05 billion, plus or minus $50 million.</div>`,
      },
    ],
  };

  // Micron Q3 FY26 — clean fiscal Q result; GAAP diluted EPS corroborates
  // across the 10-Q and IR press release like the NVDA case.
  const MU = {
    SOURCES: [
      { ic: "edgar", cls: "edgar", name: "Micron Technology — Form 10-Q", meta: "SEC EDGAR · filed Jun 26, 2026 · 42 pp", doc: 0 },
      { ic: "ir", cls: "ir", name: "Q3 FY26 press release", meta: "investors.micron.com", doc: 2 },
      { ic: "edgar", cls: "edgar", name: "Form 8-K · Exhibit 99.1", meta: "SEC EDGAR · financial schedules", doc: null },
    ],
    EXTRACT: [
      { fig: "m_rev", k: "Revenue", v: "$9.30B", conf: "high", src: "10-Q income stmt · p.4" },
      { fig: "m_ni", k: "Net income", v: "$1.88B", conf: "high", src: "10-Q income stmt · p.4" },
      { fig: "m_eps_d", k: "EPS · diluted", v: "$1.66", conf: "high", src: "10-Q p.4 + press release", corro: true },
      { fig: "m_eps_b", k: "EPS · basic", v: "$1.69", conf: "high", src: "10-Q income stmt · p.4" },
    ],
    DOCS: [
      {
        id: "mu-10q-cover", tab: "10-Q · cover", name: "mu-20260529.htm",
        meta: "SEC EDGAR · Form 10-Q",
        focus: [
          { top: 22, zoom: 1.14, fig: "m_period", callout: "Period · Q3 FY2026" },
          { top: 40, zoom: 1.15, fig: "m_cik", callout: "CIK 0000723125 ✓" },
          { top: 72, zoom: 1.14, fig: "m_shares", callout: "Shares out · 1.13B" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-gov">UNITED STATES<br><b>SECURITIES AND EXCHANGE COMMISSION</b><br>Washington, D.C. 20549</div>
            <div class="doc-form">FORM 10-Q</div>
          </div>
          <hr class="doc-rule">
          <div class="doc-check">☒ &nbsp;QUARTERLY REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934</div>
          <div class="doc-p">For the quarterly period ended ${fig("m_period", "May 29, 2026", "underline")}</div>
          <div class="doc-check">☐ &nbsp;TRANSITION REPORT PURSUANT TO SECTION 13 OR 15(d)</div>
          <div class="doc-p">Commission File Number: ${fig("m_cik", "1-10658", "box")}</div>
          <hr class="doc-rule thin">
          <div class="doc-center" style="margin:14px 0">
            <div class="doc-h1">Micron Technology, Inc.</div>
            <div class="doc-small">(Exact name of registrant as specified in its charter)</div>
          </div>
          <div class="doc-cols"><span><b>Delaware</b><br>(State of incorporation)</span><span><b>75-1618004</b><br>(I.R.S. Employer Identification No.)</span></div>
          <div class="doc-cols"><span>8000 South Federal Way<br>Boise, Idaho 83716</span><span>(208) 368-4000</span></div>
          <hr class="doc-rule thin">
          <div class="doc-p doc-small">As of June 19, 2026, the registrant had outstanding</div>
          <div class="doc-p">${fig("m_shares", "1,131,400,000", "box")} shares of common stock, $0.10 par value.</div>`,
      },
      {
        id: "mu-income", tab: "10-Q · income stmt", name: "mu-20260529.htm · p.4",
        meta: "Condensed Consolidated Statements of Operations",
        focus: [
          { top: 16, zoom: 1.13, fig: "m_rev", callout: "Revenue → $9.30B" },
          { top: 46, zoom: 1.13, fig: "m_ni", callout: "Net income → $1.88B" },
          { top: 62, zoom: 1.15, fig: "m_eps_b", callout: "EPS basic → $1.69" },
          { top: 66, zoom: 1.15, fig: "m_eps_d", callout: "EPS diluted → $1.66 ✓✓✓" },
        ],
        html: `
          <div class="doc-center">
            <div class="doc-h2" style="text-transform:uppercase">Micron Technology, Inc. and Subsidiaries</div>
            <div class="doc-h2">Condensed Consolidated Statements of Operations</div>
            <div class="doc-small">(In millions, except per share data) — (Unaudited)</div>
          </div>
          <table class="doc-tbl">
            <thead><tr><th class="l"></th><th>May 29, 2026</th><th>May 30, 2025</th></tr></thead>
            <tbody>
              <tr><td class="l">Revenue</td><td>${fig("m_rev", "$ 9,304", "box")}</td><td>$ 6,811</td></tr>
              <tr><td class="l">Cost of revenue</td><td>5,512</td><td>4,712</td></tr>
              <tr class="sub"><td class="l">Gross profit</td><td>3,792</td><td>2,099</td></tr>
              <tr class="section"><td class="l">Operating expenses:</td><td></td><td></td></tr>
              <tr><td class="l ind">Research and development</td><td>921</td><td>854</td></tr>
              <tr><td class="l ind">Sales, general and administrative</td><td>304</td><td>284</td></tr>
              <tr class="sub"><td class="l ind">Total operating expenses</td><td>1,225</td><td>1,138</td></tr>
              <tr class="sub"><td class="l">Operating income</td><td>2,567</td><td>961</td></tr>
              <tr><td class="l">Interest and other income, net</td><td>104</td><td>61</td></tr>
              <tr><td class="l">Income tax expense</td><td>791</td><td>134</td></tr>
              <tr class="total"><td class="l">Net income</td><td>${fig("m_ni", "$ 1,880", "box")}</td><td>$ 888</td></tr>
              <tr class="section"><td class="l">Net income per share:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>${fig("m_eps_b", "$ 1.69", "circle")}</td><td>$ 0.80</td></tr>
              <tr><td class="l ind">Diluted</td><td>${fig("m_eps_d", "$ 1.66", "circle")}</td><td>$ 0.79</td></tr>
              <tr class="section"><td class="l">Weighted average shares:</td><td></td><td></td></tr>
              <tr><td class="l ind">Basic</td><td>1,115</td><td>1,109</td></tr>
              <tr><td class="l ind">Diluted</td><td>1,134</td><td>1,121</td></tr>
            </tbody>
          </table>`,
      },
      {
        id: "mu-press", tab: "press release", name: "investors.micron.com",
        meta: "Press release — Q3 FY26 results",
        focus: [
          { top: 30, zoom: 1.15, fig: "m_p_rev", callout: "Revenue $9.30B ✓ matches 10-Q" },
          { top: 52, zoom: 1.16, fig: "m_p_eps", callout: "EPS $1.66 ✓ matches 10-Q p.4" },
        ],
        html: `
          <div class="doc-small" style="color:#0085ca;font-weight:700;letter-spacing:.04em">MICRON INVESTOR NEWSROOM</div>
          <hr class="doc-rule thin">
          <div class="doc-h1" style="text-transform:none;font-size:16px;line-height:1.3;margin-top:10px">Micron Technology, Inc. Reports Results for the Third Quarter of Fiscal 2026</div>
          <div class="doc-small" style="margin-top:8px">BOISE, Idaho — June 25, 2026</div>
          <div class="doc-p">Micron Technology, Inc. today reported results for its third quarter of fiscal 2026, with revenue of
            ${fig("m_p_rev", "$9.30 billion", "underline")}, up 37% from a year ago on continued HBM3E ramp.</div>
          <div class="doc-p">GAAP earnings per diluted share were ${fig("m_p_eps", "$1.66", "circle")}, up from $0.79 a year ago.
            HBM3E shipments contributed $2.1 billion of data-center revenue.</div>
          <div class="doc-p">"AI memory demand remains a multi-year tailwind," the CEO said. "We are sold out of HBM through FY27."</div>
          <div class="doc-h2">Q4 Fiscal 2026 Outlook</div>
          <div class="doc-p">Revenue is expected to be $10.0 billion, plus or minus $200 million.</div>`,
      },
    ],
  };

  window.EXAMINER_COMPANIES = { NVDA, SNDK, MU };
})();
