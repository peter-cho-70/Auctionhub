import Script from "next/script";

const INIT = `
(function(){
  try {
    var k = "auctionflow-theme";
    var t = localStorage.getItem(k);
    if (t === "system" || t === null) t = "light";
    if (t !== "light" && t !== "dim" && t !== "dark") t = "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <Script id="auctionflow-theme-init" strategy="beforeInteractive">
      {INIT}
    </Script>
  );
}
