"use client";

const FONT_AWESOME_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";

const SRI =
  "sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g";

const FONT_AWESOME_ID = "font-awesome-css";

export function FontAwesome() {
  return (
    <>
      <link
        id={FONT_AWESOME_ID}
        rel="stylesheet"
        href={FONT_AWESOME_CSS}
        crossOrigin="anonymous"
        integrity={SRI}
        media="print"
        suppressHydrationWarning={true}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var l=document.getElementById("${FONT_AWESOME_ID}");if(!l)return;function done(){if(l.media!=="all")l.media="all";}if(l.sheet){done();}else{l.addEventListener("load",done);}l.addEventListener("error",function(){l.removeAttribute("media");});})();`,
        }}
      />
      <noscript>
        <link rel="stylesheet" href={FONT_AWESOME_CSS} crossOrigin="anonymous" integrity={SRI} />
      </noscript>
    </>
  );
}
