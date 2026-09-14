<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>CardGauge Scanner — Price Any Card Free</title>
<link rel="manifest" href="/manifest.json"/>
<meta name="theme-color" content="#0a0e1a"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="CardGauge"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<meta name="description" content="The collector's workstation. Price a card, log what you paid, and see which cards you're still missing — with a scanner that reads both sides and won't guess at a price. Free to price."/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet"/>
<!-- Deferred on purpose: the scanner has to be usable before the account
     code exists. Somebody who only wants a price never waits for this. -->
<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script defer src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('D8146D3C77U3PBBHMT0G');
}(window, document, 'ttq');
</script>
<!-- ─── META PIXEL ──────────────────────────────────────────────
     LOADED INSIDE THE SCANNER, NOT ON THE PAGE AROUND IT.

     A pixel installed through Wix sits on the PARENT page. The
     scanner runs in an HTML-component iframe, which is its own
     document, so a parent pixel records a PageView when somebody
     lands and then sees nothing at all -- no scan, no save, no
     signup. And scan.cardgauge.com is a different origin entirely,
     where a Wix-installed pixel does not exist.

     That is why TikTok can report scans and Meta could not: ttq is
     in here, 33 call sites deep, and fbq was not in here at all.
     Meta could only optimise for landing-page views, which is the
     metric that says least about whether the money worked.

     Every fbq call below is guarded with `window.fbq &&`, so a
     blocked or failed pixel silently does nothing rather than
     throwing inside a click handler. -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
/* PIXEL ID: 1736032237516905 — CORRECT ALL ALONG.

   A wrong turn worth recording so it is not repeated. Events Manager,
   viewed from the personal ad account, showed only two datasets and
   neither was this one, so the conclusion was that months of Meta
   events had gone to a pixel Sebastian did not own. That was wrong.

   The pixel lives in the BIKES PLUS STUART business portfolio. It was
   invisible from the ad-account view because the ad account was not
   in that portfolio. Moving ad account 106784482747399 into the
   portfolio on 12 Sept made it appear immediately, named "CardGauge".

   So the real fault was never the ID — it was that the pixel and the
   ad account lived in different places, which is also exactly why the
   campaign builder insisted no pixel had been set up.

   Two duplicate datasets were created while diagnosing this
   (2126724101562637 and 1964774854188598) and should be deleted; they
   have no events.

   Still true from that session, and still worth having: the 46
   fbq('track','Lead') calls on trivial button taps are now
   trackCustom 'Interaction', with CompleteRegistration on account
   verification and AddToWishlist on card save. And the live campaign
   is a TRAFFIC campaign, which optimises for the cheapest landing
   page views — that, not the pixel, is why Audience Network delivered
   238 sessions and zero card lookups. */
fbq('init','1736032237516905');
fbq('track','PageView');
</script>
<style>
/* ===== CARRIED FROM THE OLD HOME PAGE =====
   Loaded first on purpose; the scanner stylesheet follows and overrides
   anything they both define. ===== */

:root{
  --bg:#0a0e1a; --bg2:#0d1320; --bg3:#0f1626;
  --surface:#111827; --surface2:#1a2235; --surface3:#212d42;
  --border:#1e2d45; --border2:#2a3a55;
  --text:#f1f5f9; --text2:#94a3b8; --text3:#64748b;
  --green:#22c55e; --red:#ef4444; --blue:#3b82f6;
  --gold:#f59e0b; --gold-warm:#fbbf24; --purple:#a855f7;
  --f:'Inter',sans-serif; --fm:'JetBrains Mono',monospace;
  --fed:'Playfair Display',serif; --fbig:'Anton',sans-serif;
  --radius:12px; --radius-lg:18px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#0a0e1a !important;}
html{font-size:15px;-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
body{font-family:var(--f);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;}
::-webkit-scrollbar{width:6px;}
::-webkit-scrollbar-track{background:var(--surface);}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px;}

.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 20px;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200;}
.tb-brand{display:flex;align-items:center;gap:11px;text-decoration:none;}
.tb-logo{font-family:var(--fbig);font-size:22px;line-height:1;color:var(--text);letter-spacing:0.5px;}
.tb-logo span{color:var(--gold);}
.tb-mark{width:38px;height:auto;flex-shrink:0;display:block;}
.tb-badge{font-size:10px;font-weight:700;color:var(--gold);border:1px solid var(--gold);padding:2px 9px;border-radius:20px;letter-spacing:1.5px;margin-left:4px;}
.tb-right{display:flex;align-items:center;gap:10px;}
.tb-binder{display:inline-block;padding:6px 13px;border-radius:100px;
  border:1px solid var(--green,#22c55e);background:rgba(34,197,94,.10);
  color:var(--green,#22c55e);font-family:var(--f);font-weight:800;font-size:12px;
  text-decoration:none;margin-right:8px;white-space:nowrap;}
.tb-binder:hover{background:rgba(34,197,94,.2);}
.tb-auth{display:flex;align-items:center;gap:7px;}
.tb-authbtn{padding:6px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0.5px;text-transform:uppercase;transition:all 0.2s;}
.tb-authbtn:hover{border-color:var(--green);color:var(--green);}
.tb-greet{font-size:10px;color:var(--text2);font-weight:600;}
.tb-greet b{color:var(--green);}
.tb-prochip{font-family:var(--fm);font-size:9.5px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:20px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:var(--gold-warm);}
.tb-tip{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);color:var(--gold);text-decoration:none;font-size:14px;line-height:1;transition:all 0.2s;flex-shrink:0;}
.tb-tip:hover{background:var(--gold);color:#0a0e1a;border-color:var(--gold);}
@media(max-width:560px){.tb-badge{display:none;}.tb-logo{font-size:19px;}.tb-mark{width:32px;}}

.combo-hero{position:relative;overflow:hidden;padding:20px 16px 32px;background:radial-gradient(ellipse at top,rgba(34,197,94,.08) 0%,transparent 55%),linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%);border-bottom:1px solid var(--border);}
.combo-hero::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 1px 1px,rgba(245,158,11,.045) 1px,transparent 0);background-size:24px 24px;opacity:.5;pointer-events:none;}
.combo-inner{position:relative;z-index:1;max-width:520px;margin:0 auto;text-align:center;}

.wordmark-gauge{position:relative;display:inline-block;margin:0 auto 4px;}
.wordmark{font-family:var(--fbig);font-weight:normal;font-size:clamp(38px,9vw,68px);line-height:0.95;letter-spacing:3px;background:linear-gradient(90deg,#3b82f6 0%,#60a5fa 18%,#f59e0b 42%,#fbbf24 58%,#4ade80 82%,#22c55e 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;text-shadow:0 0 90px rgba(245,158,11,0.15);}

.combo-tagline{font-family:var(--fed);font-style:italic;font-size:14px;color:var(--text2);line-height:1.35;margin:2px auto 18px;}
.combo-tagline em{font-style:normal;font-weight:700;color:var(--gold-warm);}

.scan-head{font-family:var(--fbig);font-size:clamp(24px,6vw,38px);line-height:1.0;letter-spacing:0.5px;color:var(--text);margin-bottom:8px;}
.scan-head span{color:var(--green);}
.scan-subhook{font-family:var(--f);font-size:14px;font-weight:600;color:var(--text2);line-height:1.5;max-width:42ch;margin:0 auto 14px;}

.sh-free{display:inline-flex;align-items:center;gap:11px;padding:9px 18px;margin:4px auto 14px;background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05));border:1.5px solid rgba(34,197,94,.4);border-radius:14px;box-shadow:0 0 40px rgba(34,197,94,.15);animation:freeGlow 4s ease-in-out infinite;}
@keyframes freeGlow{0%,100%{box-shadow:0 0 40px rgba(34,197,94,.15);}50%{box-shadow:0 0 60px rgba(34,197,94,.28);}}
.sh-free .word{font-family:var(--fbig);font-size:clamp(30px,7vw,44px);letter-spacing:3px;color:var(--green);line-height:.9;text-shadow:0 0 30px rgba(34,197,94,.4);}
.sh-free .desc{font-family:var(--f);font-weight:700;font-size:13px;color:var(--text);text-align:left;line-height:1.35;}
.sh-free .desc small{display:block;font-size:11px;font-weight:600;color:var(--text2);font-style:italic;margin-top:3px;}
@media(max-width:480px){.sh-free{padding:11px 16px;gap:9px;}}

.sh-scanner-cta{display:block;border:2px solid var(--green);border-radius:18px;padding:28px 22px;background:linear-gradient(160deg,rgba(34,197,94,.12),rgba(34,197,94,.03));cursor:pointer;transition:all .2s;text-decoration:none;text-align:center;box-shadow:0 0 40px rgba(34,197,94,.1);}
.sh-scanner-cta:hover{background:linear-gradient(160deg,rgba(34,197,94,.18),rgba(34,197,94,.06));transform:translateY(-2px);box-shadow:0 14px 40px rgba(34,197,94,.2);}
.sh-scanner-cta .sh-up-icon{font-size:44px;margin-bottom:6px;}
.sh-scanner-cta-title{font-family:var(--fbig);font-size:clamp(26px,6.5vw,38px);letter-spacing:.5px;color:var(--text);line-height:1;margin-bottom:18px;text-transform:uppercase;}
.sh-cta-steps{display:flex;flex-direction:column;gap:9px;max-width:340px;margin:0 auto 20px;text-align:left;}
.cta-step{display:flex;align-items:center;gap:11px;font-family:var(--f);font-weight:700;font-size:14px;color:var(--text);}
.cta-step b{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--green);color:#052e16;font-family:var(--fbig);font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1;}
.sh-scanner-cta-btn{display:inline-block;background:var(--green);color:#052e16;font-family:var(--fbig);font-weight:400;font-size:18px;letter-spacing:1px;padding:15px 34px;border-radius:12px;text-transform:uppercase;transition:all .2s;}
.sh-scanner-cta:hover .sh-scanner-cta-btn{background:#16a34a;box-shadow:0 6px 20px rgba(34,197,94,.35);}
@media(max-width:480px){.sh-scanner-cta-title{font-size:26px;}.cta-step{font-size:13px;}}

.sh-btn{padding:13px 16px;border-radius:10px;border:none;font-family:var(--f);font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;transition:all .2s;}
.sh-btn-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px;}
.sh-btn-ghost{background:var(--surface);color:var(--text);border:1px solid var(--border2);}
.sh-btn-ghost:hover{border-color:var(--gold);color:var(--gold);}
.sh-btn-binder{background:rgba(245,158,11,.1);color:var(--gold);border:1px solid rgba(245,158,11,.3);}
.sh-btn-binder:hover{background:rgba(245,158,11,.2);}

.sh-status{font-family:var(--fm);font-size:11px;font-weight:600;margin-top:13px;display:none;align-items:center;justify-content:center;gap:8px;padding:9px 12px;border-radius:8px;}
.sh-status.show{display:flex;}
.sh-status.loading{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);color:var(--blue);}
.sh-status.error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5;}
.sh-status.ok{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);color:#86efac;}
.sh-spinner{width:13px;height:13px;border:2px solid rgba(59,130,246,.25);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.sh-or{font-family:var(--fm);font-size:10px;color:var(--text3);letter-spacing:2px;margin:15px 0 12px;text-transform:uppercase;position:relative;}
.sh-or::before,.sh-or::after{content:'';position:absolute;top:50%;width:30%;height:1px;background:var(--border);}
.sh-or::before{left:0;}.sh-or::after{right:0;}
.sh-search{display:flex;gap:8px;}
.sh-search input{flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:13px 15px;color:var(--text);font-family:var(--f);font-size:13px;font-weight:600;outline:none;}
.sh-search input:focus{border-color:var(--green);}
.sh-search input::placeholder{color:var(--text3);}
.sh-search button{background:var(--green);color:#052e16;border:none;border-radius:10px;padding:0 20px;font-family:var(--f);font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;}

.sh-trust{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:18px;font-size:11px;color:var(--text3);font-weight:600;}
.sh-trust .pip{color:var(--green);font-weight:800;margin-right:4px;}

.sh-result{margin-top:18px;text-align:left;display:none;}
.sh-result.show{display:block;animation:fadeIn .4s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.shr-card{background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:16px;}
.shr-top{display:flex;gap:12px;margin-bottom:14px;}
.shr-img{width:60px;height:80px;border-radius:8px;object-fit:contain;background:#000;border:1px solid var(--border2);flex-shrink:0;}
.shr-img-ph{width:60px;height:80px;border-radius:8px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
.shr-name{font-size:15px;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:5px;}
.shr-meta{font-size:11px;color:var(--text2);font-weight:600;}

/* SOLD HERO — the page promises real sold prices, so lead with them */
.shr-sold{background:linear-gradient(160deg,rgba(34,197,94,.13),rgba(17,24,39,.5));border:1px solid rgba(34,197,94,.34);border-radius:12px;padding:15px 14px;margin-bottom:12px;}
.shr-sold-k{font-family:var(--fm);font-size:9.5px;letter-spacing:1.8px;text-transform:uppercase;color:var(--green);margin-bottom:5px;}
.shr-sold-v{font-size:34px;font-weight:900;letter-spacing:-1px;line-height:1;color:var(--text);}
.shr-sold-sub{font-family:var(--fm);font-size:10.5px;color:var(--text3);margin-top:7px;line-height:1.5;}
.shr-sold-sub b{color:var(--text2);}

.shr-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-radius:10px;overflow:hidden;margin-bottom:8px;}
.shr-pbox{background:var(--surface2);padding:12px 8px;text-align:center;}
.shr-plabel{font-size:8.5px;font-weight:700;color:var(--text3);letter-spacing:1.5px;margin-bottom:4px;}
.shr-pval{font-family:var(--fm);font-size:17px;font-weight:800;}
.shr-pval.main{color:var(--gold);}.shr-pval.low{color:var(--green);}.shr-pval.high{color:var(--red);}
.shr-asknote{font-family:var(--fm);font-size:10px;color:var(--text3);line-height:1.5;margin-bottom:12px;text-align:center;}
.shr-soldlink{display:block;margin-bottom:12px;padding:11px 12px;border-radius:10px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:var(--blue);font-family:var(--f);font-size:12.5px;font-weight:800;text-decoration:none;text-align:center;transition:all .2s;}
.shr-soldlink:hover{background:rgba(59,130,246,.18);}

.shr-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.shr-act{padding:12px;border-radius:10px;text-align:center;font-family:var(--f);font-size:12px;font-weight:800;text-decoration:none;cursor:pointer;border:none;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;}
.shr-act-binder{background:rgba(245,158,11,.12);color:var(--gold);border:1px solid rgba(245,158,11,.3);}
.shr-act-binder:hover{background:rgba(245,158,11,.22);}
.shr-act-full{background:linear-gradient(135deg,var(--green),#16a34a);color:#052e16;}
.shr-act-full:hover{box-shadow:0 4px 16px rgba(34,197,94,.3);}
.shr-protect{display:block;margin-top:9px;padding:12px 14px;border-radius:10px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.35);color:var(--blue);font-family:var(--f);font-size:12.5px;font-weight:700;text-decoration:none;text-align:center;transition:all .2s;}
.shr-protect:hover{background:rgba(59,130,246,.18);border-color:var(--blue);}

.auth-modal{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9998;display:none;align-items:flex-start;justify-content:center;padding:60px 20px 20px;overflow-y:auto;}
.auth-modal.show{display:flex;}
.auth-modal-inner{background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:28px;max-width:380px;width:100%;position:relative;}
.auth-modal h3{font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px;}
.auth-modal p{font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:18px;}
.auth-input{width:100%;padding:11px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-size:13px;font-weight:600;outline:none;margin-bottom:10px;}
.auth-input:focus{border-color:var(--green);}
.auth-submit{width:100%;padding:12px;border-radius:8px;border:none;background:var(--green);color:#052e16;font-family:var(--f);font-size:13px;font-weight:800;cursor:pointer;margin-top:6px;}
.auth-submit:hover{background:#16a34a;}
.auth-switch{font-size:12px;color:var(--text3);text-align:center;margin-top:14px;}
.auth-switch a{color:var(--green);cursor:pointer;text-decoration:underline;font-weight:700;}
.auth-close{position:absolute;top:14px;right:16px;background:none;border:none;color:var(--text3);font-size:22px;cursor:pointer;}
.auth-error{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:11px;font-weight:600;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:none;}
.auth-error.show{display:block;}

.full-modal{position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9998;display:none;align-items:flex-start;justify-content:center;padding:60px 20px 20px;overflow-y:auto;}
.full-modal.show{display:flex;}
.full-inner{background:radial-gradient(420px 180px at 80% 0%,rgba(245,158,11,.12),transparent 70%),var(--surface);
  border:1px solid rgba(245,158,11,.38);border-radius:var(--radius-lg);padding:30px 26px;max-width:400px;width:100%;position:relative;text-align:center;}
.full-inner h3{font-family:var(--fed);font-weight:900;font-size:23px;color:var(--text);margin-bottom:9px;letter-spacing:-.3px;}
.full-inner h3 span{color:var(--gold-warm);font-style:italic;}
.full-inner p{font-size:13.5px;color:var(--text2);line-height:1.6;margin-bottom:18px;}
.full-price{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-bottom:16px;}
.full-amt{font-family:var(--fbig);font-size:38px;color:var(--gold-warm);line-height:1;}
.full-per{font-family:var(--fm);font-size:12px;color:var(--text3);}
.full-cta{display:block;width:100%;padding:14px;border-radius:11px;border:none;cursor:pointer;
  background:linear-gradient(135deg,var(--gold-warm),#f97316);color:#1a1206;
  font-family:var(--f);font-size:14.5px;font-weight:800;box-shadow:0 6px 22px rgba(245,158,11,.28);transition:all .2s;}
.full-cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(245,158,11,.42);}
.full-alt{display:block;width:100%;margin-top:12px;background:none;border:none;color:var(--text3);
  font-family:var(--f);font-size:12.5px;font-weight:700;cursor:pointer;text-decoration:underline;}
.full-alt:hover{color:var(--text2);}
.full-fine{font-size:11px;color:var(--text3);line-height:1.6;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);}
.full-fine b{color:var(--green);}

section{padding:60px 16px;background:var(--bg);}
.wrap{max-width:1100px;margin:0 auto;}

.section-eyebrow{font-family:var(--fm);font-size:10.5px;font-weight:700;color:var(--gold);letter-spacing:3.5px;margin-bottom:11px;text-transform:uppercase;}
.section-h{font-family:var(--fed);font-weight:900;font-size:clamp(28px,5vw,42px);color:var(--text);letter-spacing:-1px;line-height:1.1;margin-bottom:14px;}
.section-h em{font-style:italic;color:var(--gold-warm);font-weight:900;}
.section-sub{font-size:15px;color:var(--text2);line-height:1.65;max-width:640px;margin-bottom:32px;}

/* ===== HOW IT WORKS =====
   Five tools and nothing on the site said they were one system. A
   first-time visitor saw a nav bar and had to guess. One line each,
   in the order somebody actually uses them. */
.flow{display:grid;gap:10px;margin-top:6px;}
.flow-step{display:flex;align-items:flex-start;gap:16px;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;
  text-decoration:none;color:inherit;transition:all .2s;position:relative;overflow:hidden;}
.flow-step::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent,var(--green));}
.flow-step:hover{border-color:var(--border2);transform:translateX(3px);}
.flow-num{flex-shrink:0;font-family:var(--fbig);font-size:22px;line-height:1;color:var(--accent,var(--green));
  width:30px;padding-top:2px;}
.flow-body{flex:1;min-width:0;}
.flow-q{font-family:var(--fed);font-style:italic;font-size:16px;color:var(--text);
  line-height:1.3;margin-bottom:4px;}
.flow-a{font-size:12.5px;color:var(--text2);line-height:1.55;}
.flow-a b{color:var(--text);}
.flow-tag{font-family:var(--fm);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent,var(--green));margin-top:7px;display:inline-block;}
.flow-cost{font-family:var(--fm);font-size:9px;letter-spacing:.08em;padding:2px 7px;border-radius:20px;
  margin-left:7px;vertical-align:middle;}
.flow-cost.free{background:rgba(34,197,94,.12);color:var(--green);}
.flow-cost.pro{background:rgba(245,158,11,.14);color:var(--gold-warm);}
@media(max-width:520px){.flow-step{padding:15px 16px;gap:12px;}.flow-q{font-size:15px;}}

.pillars{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:14px;}
@media(max-width:780px){.pillars{grid-template-columns:1fr;}}
.pillar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;position:relative;overflow:hidden;transition:all 0.25s;text-decoration:none;color:inherit;display:block;}
.pillar:hover{transform:translateY(-3px);border-color:var(--border2);box-shadow:0 14px 36px rgba(0,0,0,0.4);}
.pillar::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent, var(--gold));}
.pillar-icon{font-size:34px;margin-bottom:14px;}
.pillar-tag{font-family:var(--fm);font-size:9.5px;font-weight:700;color:var(--accent, var(--gold));letter-spacing:2px;margin-bottom:7px;text-transform:uppercase;}
.pillar-h{font-family:var(--fed);font-weight:700;font-size:22px;color:var(--text);letter-spacing:-0.5px;margin-bottom:9px;}
.pillar-desc{font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px;}
.pillar-link{font-family:var(--f);font-size:11.5px;font-weight:800;color:var(--accent, var(--gold));letter-spacing:0.5px;text-transform:uppercase;}

.protect{background:var(--bg2);border-top:1px solid var(--border);}
.protect-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;}
@media(max-width:780px){.protect-grid{grid-template-columns:1fr;}}
.protect-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;text-decoration:none;color:inherit;display:block;transition:all .25s;position:relative;overflow:hidden;}
.protect-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--blue);}
.protect-card.wg::before{background:var(--gold);}
.protect-card:hover{transform:translateY(-3px);border-color:var(--border2);box-shadow:0 14px 36px rgba(0,0,0,.4);}
.protect-icon{font-size:34px;margin-bottom:12px;}
.protect-h{font-family:var(--fed);font-weight:700;font-size:19px;color:var(--text);margin-bottom:8px;letter-spacing:-.3px;}
.protect-desc{font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px;}
.protect-link{font-family:var(--f);font-size:11.5px;font-weight:800;color:var(--blue);letter-spacing:.5px;text-transform:uppercase;}
.protect-card.wg .protect-link{color:var(--gold);}
.protect-disc{font-size:11px;color:var(--text3);line-height:1.6;margin-top:18px;text-align:center;font-style:italic;}

/* The lead block. Documentation is the half of "protect it" nobody
   thinks about until a claim, so it gets the space rather than sitting
   as one card among three. */
.insure-lead{display:flex;gap:20px;align-items:flex-start;
  background:linear-gradient(150deg,rgba(59,130,246,.09),rgba(245,158,11,.05));
  border:1px solid rgba(59,130,246,.3);border-radius:var(--radius-lg);
  padding:26px 24px;position:relative;overflow:hidden;}
.insure-lead::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--blue),var(--gold));}
.insure-lead-ico{font-size:38px;flex-shrink:0;line-height:1;}
.insure-lead-body{flex:1;min-width:0;}
.insure-lead-k{font-family:var(--fm);font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--blue);margin-bottom:8px;}
.insure-lead-h{font-family:var(--fed);font-weight:700;font-size:22px;color:var(--text);
  letter-spacing:-.4px;line-height:1.2;margin-bottom:10px;}
.insure-lead-p{font-size:13.5px;color:var(--text2);line-height:1.65;margin-bottom:16px;}
.insure-lead-p b{color:var(--text);}
.insure-lead-tiers{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;}
.tier{font-size:12px;color:var(--text2);padding:7px 14px;border-radius:100px;
  border:1px solid var(--border2);background:var(--surface);line-height:1.4;}
.tier b{font-family:var(--fm);font-size:10px;letter-spacing:.06em;margin-right:7px;}
.tier.free b{color:var(--green);}
.tier.paid b{color:var(--gold-warm);}
.insure-lead-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.insure-lead-cta{display:inline-block;padding:13px 24px;border-radius:10px;
  background:var(--blue);color:#04121f;font-size:13.5px;font-weight:800;
  text-decoration:none;letter-spacing:.2px;transition:all .2s;}
.insure-lead-cta:hover{background:#60a5fa;transform:translateY(-1px);}
.insure-lead-alt{font-size:12.5px;font-weight:700;color:var(--text2);text-decoration:none;
  border-bottom:1px solid var(--border2);padding-bottom:2px;}
.insure-lead-alt:hover{color:var(--text);border-color:var(--text3);}
.insure-lead-fine{font-size:11.5px;color:var(--text3);line-height:1.6;margin-top:16px;
  padding-top:14px;border-top:1px solid var(--border);}
@media(max-width:620px){
  .insure-lead{flex-direction:column;gap:14px;padding:22px 18px;}
  .insure-lead-h{font-size:19px;}
  .insure-lead-cta{width:100%;text-align:center;}
  .insure-lead-btns{width:100%;}
}

/* ===== WHERE THIS FITS =====
   NOT a comparison table.

   An earlier version of this section was a feature-by-feature grid
   with eBay in one column. That was the wrong shape twice over. It
   invited a checkbox argument this site loses on data — eBay's guide
   carries two years of first-party sales, pop reports from PSA and
   CGC, and a Card Ladder index — and a page that picks a fight with
   a marketplace it cannot beat reads as insecure rather than
   confident.

   So it concedes in the headline and spends the rest of the section on
   what is genuinely different. Four claims, each one checkable, none
   of them about having more data. Conceding first is what makes the
   rest believable. */
.fits{display:grid;gap:11px;margin-top:20px;}
@media(min-width:720px){.fits{grid-template-columns:1fr 1fr;}}
.fit{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px 20px;position:relative;overflow:hidden;}
.fit::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--green);}
.fit-k{font-family:var(--fed);font-style:italic;font-size:17px;color:var(--text);
  line-height:1.3;margin-bottom:8px;}
.fit-v{font-size:13px;color:var(--text2);line-height:1.65;}
.fit-v b{color:var(--text);}
.fits-foot{margin-top:16px;padding:16px 18px;border-radius:var(--radius);
  background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.24);
  font-size:13px;line-height:1.7;color:var(--text2);}
.fits-foot b{color:var(--text);}

/* ===== THE FOUR THINGS NOBODY ELSE DOES =====
   Placed immediately under the scanner, not down the page with the
   other feature sections.

   THE REASON: eBay now ships a free, unlimited card scanner with two
   years of first-party sales behind it. Pricing is no longer a reason
   to be here, so a page that spends its first screen on pricing is
   spending it on the one thing a visitor can get elsewhere. Somebody
   who scans a card and leaves has seen only the part eBay also has.

   Four claims, each one a thing a collector can check, and each one
   answering "why this instead of the app already on my phone". Kept to
   four because a list of seven reads as a menu nobody chooses from —
   which is the state the rest of this page is already in. */
.only{margin:20px 0 4px;}
.only-k{font-family:var(--fm);font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);text-align:center;margin-bottom:14px;}
.only-grid{display:grid;gap:10px;}
@media(min-width:640px){.only-grid{grid-template-columns:1fr 1fr;}}
.only-item{display:flex;gap:13px;align-items:flex-start;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--radius);padding:15px 16px;
  text-decoration:none;color:inherit;transition:all .2s;}
.only-item:hover{border-color:var(--border2);transform:translateY(-1px);}
.only-ico{font-size:22px;flex-shrink:0;line-height:1.15;}
.only-body{flex:1;min-width:0;}
.only-t{font-size:13.5px;font-weight:800;color:var(--text);line-height:1.35;margin-bottom:4px;}
.only-d{font-size:12px;color:var(--text2);line-height:1.55;}
.only-d b{color:var(--green);}
.only-foot{font-family:var(--fm);font-size:10.5px;line-height:1.7;color:var(--text3);
  text-align:center;margin-top:13px;}
.only-foot b{color:var(--text2);}

/* The scanner used to be introduced by the headline. Now that the
   headline names the whole bench, the tool has to say what it is —
   one line, above the capture slots, so somebody arriving mid-page
   still knows what they are looking at. */
.scan-intro{font-family:var(--fm);font-size:11px;line-height:1.7;color:var(--text3);
  text-align:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);}
.scan-intro b{color:var(--green);font-family:var(--f);font-size:12.5px;font-weight:800;}

.manifesto{background:radial-gradient(ellipse at center, rgba(245,158,11,0.05) 0%, transparent 60%), var(--bg);text-align:center;padding:54px 16px;}
.manifesto-eyebrow{font-family:var(--fm);font-size:10.5px;font-weight:700;color:var(--gold);letter-spacing:4px;margin-bottom:18px;text-transform:uppercase;}
.manifesto-body{font-family:var(--fed);font-weight:400;font-size:clamp(19px,2.6vw,25px);color:var(--text);line-height:1.5;max-width:720px;margin:0 auto;letter-spacing:-0.3px;}
.manifesto-body em{color:var(--gold-warm);font-style:italic;font-weight:700;}
.manifesto-author{margin-top:22px;font-family:var(--fm);font-size:11px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;}

.honest{background:var(--bg2);padding:54px 16px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.honest-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;}
@media(max-width:780px){.honest-grid{grid-template-columns:1fr;}}
.honest-col{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;}
.honest-col h3{font-family:var(--fed);font-size:18px;font-weight:700;color:var(--text);margin-bottom:14px;letter-spacing:-0.3px;}
.honest-col ul{list-style:none;display:flex;flex-direction:column;gap:9px;}
.honest-col li{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:var(--text2);line-height:1.5;}
.honest-col .mark{flex-shrink:0;width:18px;font-weight:800;font-size:14px;}
.honest-col.no .mark{color:var(--red);}.honest-col.yes .mark{color:var(--green);}
.honest-col.no h3{color:#fca5a5;}.honest-col.yes h3{color:#86efac;}

.finale{padding:80px 16px;text-align:center;background:linear-gradient(180deg, var(--bg) 0%, #0a0a14 100%);}
.finale-h{font-family:var(--fed);font-weight:900;font-size:clamp(28px,5vw,44px);color:var(--text);letter-spacing:-1px;line-height:1.15;margin-bottom:14px;}
.finale-h em{font-style:italic;color:var(--gold-warm);}
.finale-sub{font-size:15px;color:var(--text2);max-width:540px;margin:0 auto 26px;line-height:1.6;}
.finale-btn{display:inline-block;padding:16px 36px;border-radius:10px;background:linear-gradient(135deg, var(--gold-warm), #f97316);color:#0a1628;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 6px 26px rgba(245,158,11,0.3);transition:all 0.2s;}
.finale-btn:hover{transform:translateY(-2px);box-shadow:0 10px 36px rgba(245,158,11,0.45);}
.finale-perks{display:flex;justify-content:center;gap:20px;margin-top:20px;flex-wrap:wrap;font-size:11px;color:var(--text2);font-weight:600;}
.finale-perks span{display:flex;align-items:center;gap:5px;}
.finale-perks .check{color:var(--green);font-weight:800;}


.foot{padding:30px 16px 36px;background:#06080f;border-top:1px solid var(--border);text-align:center;}
.foot-row{max-width:1100px;margin:0 auto;}
.foot-logo{font-family:var(--fbig);font-size:22px;color:var(--text);margin-bottom:8px;letter-spacing:0.5px;line-height:1;}
.foot-logo span{color:var(--gold);}
.foot-tag{font-family:var(--fed);font-style:italic;font-size:12px;color:var(--text3);margin-bottom:18px;}
.foot-links{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-size:11px;color:var(--text3);margin-bottom:16px;}
.foot-links a{color:var(--text2);text-decoration:none;font-weight:600;transition:color 0.2s;}
.foot-links a:hover{color:var(--gold);}
.foot-tiktok{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:20px;background:linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%);color:#fff;font-size:11px;font-weight:800;text-decoration:none;letter-spacing:0.5px;margin-bottom:14px;}
.foot-bmac{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:20px;background:transparent;border:1.5px solid var(--gold);color:var(--gold);font-size:11px;font-weight:800;text-decoration:none;letter-spacing:0.5px;margin-bottom:14px;margin-left:8px;transition:all 0.2s;}
.foot-bmac:hover{background:var(--gold);color:#0a0e1a;}
.foot-fine{font-size:10px;color:var(--text3);line-height:1.6;max-width:600px;margin:0 auto;}

.lb{margin-top:14px;border:1px solid rgba(34,197,94,.3);border-radius:var(--radius-lg);background:linear-gradient(160deg,rgba(34,197,94,.06),rgba(17,24,39,.4));overflow:hidden;}
.lb-top{display:flex;align-items:baseline;gap:8px;padding:13px 15px 9px;border-bottom:1px solid var(--border);flex-wrap:wrap;}
.lb-n{font-family:var(--fm);font-size:10.5px;color:var(--text3);}
.lb-row{display:flex;justify-content:space-between;gap:10px;padding:9px 15px;border-bottom:1px solid var(--border);font-size:12.5px;}
.lb-name{color:var(--text);min-width:0;overflow-wrap:anywhere;}
.lb-val{font-family:var(--fm);color:var(--green);white-space:nowrap;}
.lb-more{padding:8px 15px;font-family:var(--fm);font-size:10.5px;color:var(--text3);}
.lb-cta{padding:13px 15px;background:rgba(0,0,0,.2);border-top:1px solid var(--border);}
.lb-why{font-size:12px;line-height:1.6;color:var(--text2);margin-bottom:11px;}
.lb-why b{color:var(--gold-warm);}
.lb-btn{width:100%;padding:13px;border-radius:11px;border:none;background:var(--green);color:#052e16;font-family:var(--f);font-size:14px;font-weight:800;cursor:pointer;}
.lb-fine{font-family:var(--fm);font-size:9.5px;color:var(--text3);text-align:center;margin-top:8px;}
/* THREE PANELS OF TEACHING COPY, ONCE PER CARD, FOREVER.

   The short-print, copyright-year and serial-number checks ran about
   two and a half phone screens between the price and the eBay link. The
   INPUTS are the valuable part -- each one is somebody telling CardGauge
   it read their card wrong, which is a labelled correction no
   competitor has. The paragraphs explaining why the field exists are
   read once and scrolled past every time after that.

   So the prose collapses and the fields stay. Tap the heading to read
   the explanation; it is the same words, not a shortened version.

   The clamp deliberately skips anything with an id. #pcodeOut and
   #serOut are also .pcode-v and they hold the ANSWER -- clamping a
   result to one line would hide the thing the person just asked for. */
/* One box, three rows. The label column is what makes it scannable --
   Code / Year / Serial reads down, instead of three titles read across. */
.fixbox{margin:9px 0 0;padding:11px 13px;border:1px solid var(--border,rgba(255,255,255,.12));
  border-radius:12px;background:rgba(255,255,255,.03);}
.fixhead{display:flex;align-items:center;justify-content:space-between;gap:8px;
  font-family:var(--fm,monospace);font-size:10.5px;letter-spacing:1.2px;color:var(--text3,#94a3b8);}
.fixtog{cursor:pointer;user-select:none;font-family:var(--f,inherit);font-size:11px;
  letter-spacing:0;color:var(--text3,#64748b);}
.fixtog i{font-style:normal;font-size:9px;display:inline-block;transition:transform .15s;}
.fixbox.open .fixtog i{transform:rotate(180deg);}
.fixsub{font-size:11.5px;color:var(--text3,#64748b);margin:2px 0 10px;}
.fixrow{display:flex;align-items:flex-start;gap:9px;margin-top:7px;}
.fixrow:first-of-type{margin-top:0;}
.fixlbl{flex:0 0 50px;font-size:12px;color:var(--text2,#94a3b8);padding-top:9px;}
.fix-serial .fixlbl{color:var(--gold-warm,#fbbf24);}
.fixctl{flex:1;min-width:0;}
.fixctl .ser-in{margin:0;}
/* Folded, not shortened. The notes are the same words, one tap away. */
.fixbox:not(.open) .fixctl .pcode-v:not([id]),
.fixbox:not(.open) .fixctl .corr-hint{display:none;}
/* The glare block ran a full paragraph, a button and an affiliate line
   on every result -- taller than all three correction rows combined,
   and read once. Folded to a line; tap opens it. */
.cpl.cplfold:not(.open) .cpl-body{display:none;}
.cpl.cplfold:not(.open){padding-top:10px;padding-bottom:10px;}
.cpl .cpl-h{cursor:pointer;user-select:none;}
.cpl .cpl-h i{font-style:normal;font-size:10px;opacity:.65;display:inline-block;transition:transform .15s;}
.cpl.open .cpl-h i{transform:rotate(180deg);}
.pcode{margin:7px 0 0;padding:9px 11px;border:1px solid var(--border,rgba(255,255,255,.12));
  border-radius:10px;background:rgba(255,255,255,.03);}
.pcode-t{font-family:var(--fm,monospace);font-size:10.5px;letter-spacing:1.3px;color:var(--text3,#94a3b8);
  margin-bottom:5px;cursor:pointer;user-select:none;display:flex;align-items:center;gap:7px;}
.pcode-t::after{content:'\25BE';font-size:9px;opacity:.55;transition:transform .15s;}
.pcode.open .pcode-t::after{transform:rotate(180deg);}
.pcode:not(.open) .pcode-v:not([id]){display:-webkit-box;-webkit-line-clamp:1;
  -webkit-box-orient:vertical;overflow:hidden;opacity:.72;}
.pcode:not(.open) .pcode-v:not([id]) b{font-weight:700;opacity:1;}
.pcode-v{font-size:13.5px;color:var(--text,#f1f5f9);line-height:1.5;}
.pcode-sp{color:#fbbf24;font-weight:700;}
.pcode-in{display:flex;gap:6px;margin-top:9px;}
.pcode-in input{width:96px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:8px;padding:9px 10px;color:#f1f5f9;font-family:var(--fm,monospace);font-size:15px;text-align:center;}
.pcode-in button{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#f1f5f9;
  border-radius:8px;padding:9px 13px;font-family:inherit;font-size:13px;cursor:pointer;}

/* The account wall. Deliberately the same visual language as the rest
   of the app rather than an interstitial -- it is a step, not a stop. */
.cgw-ov{position:fixed;inset:0;background:rgba(4,8,16,.88);z-index:99998;
  display:flex;align-items:center;justify-content:center;padding:22px 16px;overflow-y:auto;}
.cgw{background:#111827;border:1px solid #2a3a55;border-radius:18px;
  padding:28px 24px 24px;max-width:400px;width:100%;position:relative;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;color:#f1f5f9;}
.cgw-x{position:absolute;top:12px;right:15px;background:none;border:none;
  color:#64748b;font-size:25px;line-height:1;cursor:pointer;}
.cgw-h{font-size:20px;font-weight:900;letter-spacing:-.4px;line-height:1.25;
  margin-bottom:9px;}
.cgw-p{font-size:13.5px;color:#94a3b8;line-height:1.6;margin-bottom:17px;}
.cgw-p b{color:#f1f5f9;}
.cgw-list{list-style:none;margin:0 0 20px;padding:0;display:grid;gap:9px;}
.cgw-list li{display:flex;gap:10px;align-items:center;font-size:13.5px;color:#cbd5e1;}
.cgw-list li span{color:#22c55e;font-weight:800;}
.cgw-cta{width:100%;padding:15px;border-radius:11px;border:none;
  background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1206;
  font-family:inherit;font-size:14.5px;font-weight:800;letter-spacing:.4px;
  cursor:pointer;box-shadow:0 6px 22px rgba(245,158,11,.28);}
.cgw-cta:hover{transform:translateY(-1px);}
.cgw-alt{text-align:center;font-size:12.5px;color:#64748b;margin-top:14px;}
.cgw-alt a{color:#fbbf24;font-weight:700;cursor:pointer;text-decoration:underline;}

/* ── SERIAL NUMBER BOX ───────────────────────────────────────────
   Shares the .pcode shell above so the short-print check and the
   numbered check read as a pair. Only the extras are here. */
.ser-in{display:flex;gap:6px;margin-top:9px;}
.ser-in input{width:108px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  color:#f1f5f9;border-radius:7px;padding:8px 10px;font-family:var(--fm,monospace);font-size:14px;}
.ser-in button{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#f1f5f9;
  border-radius:7px;padding:8px 13px;font-family:inherit;font-size:13px;font-weight:700;
  cursor:pointer;white-space:nowrap;}
.ser-in button:disabled{opacity:.5;cursor:default;}
.ser-on{color:#fbbf24;font-weight:700;}
.ser-none{color:#f87171;font-weight:700;}
.ser-copy{font-family:var(--fm,monospace);font-size:11.5px;color:var(--text3,#94a3b8);margin-top:6px;}
.lb-mail{display:flex;gap:6px;margin:10px 0 4px;}
.lb-mail input{flex:1;min-width:0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:9px;padding:11px 12px;color:#f1f5f9;font-family:inherit;font-size:14px;}
.lb-mail input:focus{outline:none;border-color:rgba(34,197,94,.55);}
.lb-mail button{background:#22c55e;color:#052e16;border:none;border-radius:9px;padding:11px 15px;
  font-family:inherit;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap;}
.lb-alt{margin-top:13px;padding-top:12px;border-top:1px solid var(--border);
  font-size:12px;line-height:1.6;color:var(--text3);}
.lb-alt a{color:var(--green);cursor:pointer;font-weight:700;white-space:nowrap;}
.lb-alt a:hover{text-decoration:underline;}
.lb-alt-fine{display:block;font-family:var(--fm);font-size:9.5px;color:var(--text3);margin-top:3px;}
.lb-no{display:block;width:100%;background:none;border:none;font-family:var(--fm);font-size:10px;letter-spacing:.08em;color:var(--text3);padding:9px 0 2px;cursor:pointer;text-decoration:underline;}
.redeem{margin:0 16px 14px;padding:14px 16px;border:2px solid rgba(239,68,68,.45);border-radius:var(--radius-lg);background:rgba(239,68,68,.07);}
.redeem-h{font-size:14.5px;font-weight:800;color:#fca5a5;margin-bottom:8px;line-height:1.35;}
.redeem-p{font-size:12.5px;line-height:1.65;color:var(--text2);}
.redeem-p b{color:#fff;}
.warn-box{margin:0 16px 12px;padding:13px 15px;border:1px solid rgba(239,68,68,.42);
  border-radius:12px;background:rgba(239,68,68,.09);}
.warn-h{font-size:14px;font-weight:800;color:#fca5a5;line-height:1.4;margin-bottom:6px;}
.warn-p{font-size:12.5px;color:var(--text2);line-height:1.6;}
.cpl{margin:0 16px 14px;padding:13px 15px;border:1px solid rgba(245,158,11,.32);border-radius:var(--radius-lg);background:rgba(245,158,11,.06);}
.cpl-h{font-size:14px;font-weight:800;color:var(--gold-warm);margin-bottom:6px;}
.cpl-p{font-size:12.5px;line-height:1.65;color:var(--text2);}
.cpl-btn{display:inline-block;margin-top:10px;padding:9px 15px;border-radius:9px;border:1px solid rgba(245,158,11,.45);color:var(--gold-warm);text-decoration:none;font-family:var(--fm);font-size:11.5px;}
.cpl-fine{font-family:var(--fm);font-size:9.5px;color:var(--text3);margin-top:8px;}
.sl{margin:0 16px 12px;border:1px solid var(--border);border-radius:12px;overflow:hidden;}
.sl-t{font-family:var(--fm);font-size:9.5px;letter-spacing:1.6px;color:var(--text3);
  padding:10px 13px 8px;border-bottom:1px solid var(--border);}
.sl-row{display:flex;align-items:baseline;gap:12px;padding:9px 13px;
  border-bottom:1px solid rgba(255,255,255,.04);text-decoration:none;}
.sl-row:last-of-type{border-bottom:none;}
.sl-hid{display:none;}
.sl-p{font-family:var(--fm);font-size:14px;font-weight:700;color:var(--green);
  min-width:62px;flex:none;}
.sl-m{font-family:var(--fm);font-size:11px;color:var(--text3);}
.sl-g{color:var(--gold-warm);}
.sl-more{width:100%;background:none;border:none;border-top:1px solid var(--border);
  color:var(--text2);font-family:var(--fm);font-size:11px;padding:10px;cursor:pointer;}
.sl-more:hover{background:rgba(255,255,255,.03);}
.vline{margin:0 16px 10px;font-family:var(--fm);font-size:10.5px;line-height:1.6;}
.vline-ok{color:var(--green);opacity:.85;}
.vline-off{color:var(--text3);}
.dec{padding:16px;border-top:1px solid var(--border);}
.dec-k{font-family:var(--fm);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;
  color:var(--text3);margin-bottom:11px;}
.dec-card{border:1px solid var(--border);border-radius:12px;padding:13px 15px;margin-bottom:9px;}
.dec-card:last-child{margin-bottom:0;}
.dec-rec{border:2px solid rgba(34,197,94,.5);background:rgba(34,197,94,.05);}
.dec-tag{font-family:var(--fm);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--green);margin-bottom:6px;}
.dec-h{font-size:17px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:10px;}
.dec-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.dec-name{font-size:14.5px;font-weight:800;color:var(--text);}
.dec-badge{margin-left:auto;font-family:var(--fm);font-size:10px;letter-spacing:.06em;
  padding:3px 9px;border-radius:100px;}
.dec-badge.ok{background:rgba(34,197,94,.14);color:var(--green);}
.dec-badge.warn{background:rgba(245,158,11,.14);color:var(--gold-warm);}
.dec-t{width:100%;font-size:13px;color:var(--text2);}
.dec-t td{padding:2px 0;}
.dec-t td:last-child{text-align:right;color:var(--text);font-family:var(--fm);}
.dec-fine{font-size:11.5px;line-height:1.6;color:var(--text3);margin-top:9px;}
.dec-off{font-size:12.5px;line-height:1.6;color:var(--gold-warm);
  background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.3);
  border-radius:10px;padding:11px 13px;}
.dec-off b{color:#fff;}
.dec-top{display:flex;align-items:center;gap:11px;margin-bottom:12px;}
.dec-img{width:44px;height:62px;object-fit:cover;border-radius:7px;border:1px solid var(--border2);background:#000;flex-shrink:0;}
.dec-sub{font-size:12.5px;color:var(--text2);line-height:1.35;}
.dec-cost{display:flex;align-items:center;gap:9px;margin:11px 0 0;padding:11px 13px;border:1px solid var(--border);border-radius:12px;}
.dec-cost label{font-size:13px;color:var(--text2);flex:1;}
.dec-cost input{width:96px;padding:9px 11px;border-radius:9px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--fm);font-size:15px;}
.scan-again{padding:16px;border-top:1px solid var(--border);text-align:center;}
/* GREEN MEANS "DO THIS". IT CANNOT MEAN THAT FOUR TIMES.

   Counted on one result screen: the keep banner, this, the save row,
   and the bench were all solid green, all full width, all the same
   weight. When everything is the primary action, nothing is -- the eye
   has no order to follow and the page reads as a wall of buttons
   rather than a next step.

   Keeping the card is the one action worth pushing after a scan; it is
   what makes somebody come back. Scanning again is what people already
   do without being told -- the funnel says 3.4 cards a session once
   they start. It needs to be present and obvious, not competing.

   Outlined, not filled. Same size, same position, still unmissable. */
.scan-again-btn{width:100%;padding:15px;border-radius:12px;
  border:1px solid rgba(34,197,94,.45);background:transparent;
  color:var(--green);font-family:var(--f);font-size:15px;font-weight:800;cursor:pointer;
  transition:all .18s;}
.scan-again-btn:hover{background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.7);}
.scan-again-sub{font-family:var(--fm);font-size:10.5px;color:var(--text3);margin-top:9px;}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surface3);color:var(--text);padding:10px 20px;border-radius:8px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid var(--border2);}


.pro-sec{background:var(--bg2);border-top:1px solid var(--border);}
.pro-card{background:radial-gradient(500px 220px at 82% 0%,rgba(245,158,11,.10),transparent 70%),var(--surface);border:1px solid rgba(245,158,11,.35);border-radius:var(--radius-lg);padding:30px 26px;margin-top:8px;position:relative;overflow:hidden;}
.pro-flag{display:inline-block;font-family:var(--fm);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#1a1206;background:var(--gold-warm);padding:4px 12px;border-radius:100px;font-weight:800;margin-bottom:14px;}
.pro-h{font-family:var(--fed);font-weight:900;font-size:clamp(24px,5vw,34px);color:var(--text);letter-spacing:-.5px;line-height:1.05;}
.pro-price{display:flex;align-items:baseline;gap:10px;margin:16px 0 3px;flex-wrap:wrap;}
.pro-amt{font-family:var(--fbig);font-size:46px;color:var(--gold-warm);line-height:1;}
.pro-per{font-family:var(--fm);font-size:13px;color:var(--text3);}
.pro-intro{font-family:var(--fm);font-size:11px;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;margin-bottom:20px;}
.pro-list{list-style:none;margin:20px 0;display:grid;gap:12px;}
.pro-list li{display:flex;gap:11px;align-items:flex-start;font-size:14px;color:var(--text2);line-height:1.45;}
.pro-list .ck{color:var(--gold-warm);flex-shrink:0;font-weight:800;}
.pro-list b{color:var(--text);}
.foot-pro{font-size:12px;color:var(--text3);margin:10px 0 2px;line-height:1.7;}
.foot-pro b{color:var(--text2);font-weight:700;}
.foot-pro a{color:var(--gold-warm);text-decoration:none;font-weight:700;white-space:nowrap;}
.foot-pro a:hover{text-decoration:underline;}
.pro-cta{display:inline-flex;align-items:center;gap:9px;background:linear-gradient(135deg,var(--gold-warm),#f97316);color:#1a1206;font-family:var(--f);font-weight:800;font-size:15px;padding:15px 28px;border-radius:12px;text-decoration:none;margin-top:4px;box-shadow:0 6px 22px rgba(245,158,11,.28);transition:all .2s;border:none;cursor:pointer;}
.pro-cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(245,158,11,.42);}
.pro-free{margin-top:18px;padding-top:16px;border-top:1px solid var(--border);font-size:12.5px;color:var(--text3);line-height:1.6;}
.pro-free b{color:var(--green);}

@media(max-width:768px){
  .sh-free{animation:none !important;box-shadow:0 0 20px rgba(34,197,94,.12) !important;}
  .sh-scanner-cta{box-shadow:none !important;}
  .finale-btn,.foot-bmac{box-shadow:none !important;}
  *{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}
  .pillar,.protect-card,.flow-step{transition:none !important;}
  body{-webkit-overflow-scrolling:touch;}
}

</style>

<style>
:root{
  --bg:#0a0e1a; --surface:#111827; --surface2:#1a2235; --surface3:#212d42;
  --border:#1e2d45; --border2:#2a3a55;
  --text:#f1f5f9; --text2:#94a3b8; --text3:#64748b;
  --green:#22c55e; --red:#ef4444; --blue:#3b82f6; --gold:#f59e0b; --gold-warm:#fbbf24;
  --f:'Inter',sans-serif; --fm:'JetBrains Mono',monospace; --fbig:'Anton',sans-serif;
  --radius:12px; --radius-lg:18px;
  /* Aliases. These three were referenced throughout the stylesheet but never
     defined, so every rule using them silently fell back to inherited colour. */
  --bone:#f1f5f9; --dim:#94a3b8; --line:#1e2d45;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
/* THE PAGE COULD SCROLL SIDEWAYS, SO TYPING MOVED IT.

   Reported 14 Sept: every keystroke shifted the screen left. The cause
   is visible in any screenshot -- the top bar is cut off mid-word,
   "LOG OU". Something is wider than the viewport, which makes the whole
   document horizontally scrollable, and focusing an input makes the
   browser scroll sideways to bring it fully into view. Every character
   re-triggers it.

   The top bar is the widest offender: it is a flex row with a logo, a
   binder pill, a greeting, a PRO badge and a Log Out button, and
   justify-content:space-between never shrinks them.

   Two fixes, both needed. min-width:0 lets the flex children actually
   compress instead of forcing the row wide. overflow-x:hidden on the
   document stops any remaining overflow from becoming a scroll
   position the browser can jump to.

   stats.html has had this since it was written. The scanner never did. */
html,body{background:var(--bg) !important;overflow-x:hidden;max-width:100%;}
.topbar{min-width:0;}
.topbar > *{min-width:0;}
.tb-right{min-width:0;flex-shrink:1;}
.tb-user{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
html{font-size:15px;-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
body{font-family:var(--f);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;}
::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:var(--surface);}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px;}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 20px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200;}
.tb-brand{display:flex;align-items:center;gap:10px;text-decoration:none;}
.tb-logo{font-family:var(--fbig);font-size:22px;color:var(--text);letter-spacing:0.5px;}
.tb-logo span{color:var(--gold);}
.tb-badge{font-size:10px;font-weight:700;color:var(--green);border:1px solid var(--green);padding:2px 9px;border-radius:20px;letter-spacing:1px;}
.tb-cta{font-family:var(--f);font-size:12px;font-weight:800;color:var(--gold);text-decoration:none;padding:8px 15px;border:1px solid var(--gold);border-radius:100px;transition:all .2s;white-space:nowrap;}
.tb-cta:hover{background:var(--gold);color:var(--bg);}
@media(max-width:520px){.tb-cta{font-size:11px;padding:7px 11px;}.tb-badge{display:none;}}
.hero{text-align:center;padding:40px 20px 20px;max-width:640px;margin:0 auto;}
.hero-eyebrow{font-family:var(--fm);font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--green);margin-bottom:14px;}
.hero h1{font-family:var(--fbig);font-size:clamp(34px,7vw,54px);line-height:0.98;letter-spacing:0.5px;margin-bottom:14px;}
.hero h1 span{color:var(--green);}
.hero p{font-size:16px;color:var(--text2);line-height:1.55;max-width:34ch;margin:0 auto;}
/* The free line carries more weight now that a price appears sooner
   down the page, so it gets room to breathe and the word itself is
   allowed to shout. */
.hero-free b{color:#fff;font-weight:900;letter-spacing:.4px;}
.hero-cta{display:inline-block;margin-top:16px;padding:15px 34px;border-radius:12px;
  background:var(--green);color:#052e16;font-family:var(--f);font-weight:800;font-size:16px;
  letter-spacing:.2px;text-decoration:none;box-shadow:0 6px 22px rgba(34,197,94,.28);
  transition:all .2s;}
.hero-cta:hover{background:#16a34a;transform:translateY(-2px);box-shadow:0 10px 30px rgba(34,197,94,.4);}
.hero-cta-fine{font-family:var(--fm);font-size:11px;color:var(--text3);margin-top:9px;letter-spacing:.04em;}
@media(max-width:520px){.hero-cta{display:block;width:100%;text-align:center;padding:16px;}}
/* Was inline-flex, which turned the two halves into flex items and
   let them wrap into an unreadable two-column block at narrow widths --
   "Scanning & pricing:" stacked beside "free forever, no signup, no
   limit" in three ragged columns. It is a sentence; it should wrap like
   one. */
.hero-free{display:block;margin:16px auto 0;padding:9px 18px;max-width:44ch;
  background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);border-radius:14px;
  font-family:var(--fm);font-size:11.5px;font-weight:600;color:var(--green);
  line-height:1.7;text-align:center;}
.wrap{max-width:640px;margin:0 auto;padding:20px 20px 60px;}
.scan-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px 22px;margin-bottom:18px;position:relative;z-index:1;}
/* ===== TWO-SLOT CAPTURE =====
   Front and back sit side by side as equals. The back used to be an
   afterthought tucked under the front, which framed it as extra work
   rather than as the thing that makes the answer right. It isn't extra
   work — the back carries the card number, set and year as printed text,
   so a two-sided scan reads data where a one-sided scan has to guess from
   a picture. Front-only still works in one tap; it's just no longer the
   thing the layout is steering you toward. */
.dual{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.slot{position:relative;display:flex;flex-direction:column;align-items:center;
  padding:13px 10px 12px;border-radius:14px;cursor:pointer;transition:all .18s;
  border:1px dashed var(--border2);background:var(--surface2);}
/* ===== THE BACK SLOT IS THE POINT =====
   Two-sided scanning is the one thing here no other card scanner does,
   and it was styled like an optional extra sitting quietly next to the
   required one. A collector skipped it, got a wrong year back, and
   posted publicly that the tool needed work — which is what
   understating your best feature earns you.

   So it is now the brighter of the two, it says what it buys you, and
   it keeps a soft pulse while empty. Not decoration: the eye goes to
   movement, and this is the one place on the page where drawing the eye
   changes the answer somebody gets. */
.slot.back{border-color:rgba(34,197,94,.55);border-width:2px;
  background:linear-gradient(160deg,rgba(34,197,94,.12),rgba(34,197,94,.04));}
.slot.back:not(.filled){animation:backpulse 2.6s ease-in-out infinite;}
@keyframes backpulse{
  0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}
  50%    {box-shadow:0 0 22px 0 rgba(34,197,94,.22);}
}
@media (prefers-reduced-motion:reduce){
  .slot.back:not(.filled){animation:none;box-shadow:0 0 18px rgba(34,197,94,.16);}
}
.slot.back .slot-tag{color:var(--green);}

/* A badge, because "the back is better" is worth stating outright
   rather than hoping somebody infers it from a border colour. */
.slot-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);
  font-family:var(--fm);font-size:8.5px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;white-space:nowrap;padding:3px 10px;border-radius:100px;
  background:var(--green);color:#052e16;box-shadow:0 2px 10px rgba(34,197,94,.35);}
.slot.filled .slot-badge{background:var(--border2);color:var(--text3);box-shadow:none;}
.slot.filled{border-style:solid;border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.07);}
.slot.drag{border-color:var(--green);background:rgba(34,197,94,.12);}
@media (hover:hover) and (pointer:fine){
  .slot:hover{border-color:rgba(34,197,94,.5);}
  .slot:hover .corner{box-shadow:0 0 8px rgba(34,197,94,.4);}
}
.slot-tag{font-family:var(--fm);font-size:9.5px;letter-spacing:.15em;color:var(--text3);
  margin-bottom:9px;text-transform:uppercase;}
.slot.filled .slot-tag{color:var(--green);}
.slot-body{position:relative;width:100%;max-width:106px;aspect-ratio:5/7;margin-bottom:9px;}
.slot-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  border-radius:7px;display:none;border:1px solid rgba(34,197,94,.55);}
.slot.filled .slot-img{display:block;}
.slot.filled .scanframe{display:none;}
.slot-label{font-size:11.5px;font-weight:700;color:var(--text2);text-align:center;line-height:1.3;}
.slot.filled .slot-label{color:var(--green);}
.slot-hint{font-family:var(--fm);font-size:9px;color:var(--text3);margin-top:3px;letter-spacing:.04em;}
/* The back is where the accuracy comes from, so its label is not
   allowed to look like fine print. "much more accurate" was a benefit
   and benefits get skipped: a collector went front-only, got a wrong
   year back, and posted publicly that the tool needed work. It didn't
   — it was guessing from artwork because nobody told him what the back
   was for. */
.slot-hint.strong{color:var(--green);font-weight:600;}
.slot.filled .slot-hint{display:none;}
.slot-x{position:absolute;top:7px;right:7px;width:24px;height:24px;border-radius:50%;
  border:1px solid var(--border2);background:var(--surface);color:var(--text3);
  font-size:14px;line-height:1;cursor:pointer;display:none;padding:0;}
.slot.filled .slot-x{display:block;}
.slot-x:hover{border-color:var(--red);color:var(--red);}

/* The slot reticle is the same component as the big one, only smaller —
   it MUST keep the .scanframe class, because the corner-position rules
   (.tl/.tr/.bl/.br), the card art and the scanline are all scoped to it.
   Give it a different class name and all four corners collapse into one
   stacked square in the top-left. */
.scanframe.mini{position:absolute;inset:0;width:auto;height:auto;margin:0;border-radius:8px;}
.scanframe.mini .corner{width:17px;height:17px;border-width:2px;}
.scanframe.mini .fcard{inset:6px;}
.scanframe.mini .serial{font-size:7px;top:5px;right:6px;}
.scanframe.mini .bust{width:34px;height:40px;bottom:18px;}
.scanframe.mini .bust i{width:14px;height:15px;}
.scanframe.mini .bust b{height:24px;}
.scanframe.mini .plate{left:8px;right:8px;bottom:7px;}
.scanframe.mini .plate u{height:4px;}
.scanframe.mini .plate s{height:2px;margin-top:3px;}
.scanframe.mini .scanline{left:6px;right:6px;top:6px;}
.scanframe.mini .flip{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-size:26px;color:var(--blue);opacity:.5;}
@keyframes scanSweepMini{0%{top:6px;opacity:0;}12%{opacity:1;}50%{top:calc(100% - 8px);opacity:1;}88%{opacity:1;}100%{top:6px;opacity:0;}}
.scanframe.mini .scanline{animation:scanSweepMini 2.4s ease-in-out infinite;}

/* The whole thing reads, not just the first line.
   Grey at 11.5px is the size and colour of a disclaimer, and people
   have learned to skip disclaimers — which is how an experienced
   collector came to miss the one instruction that decides whether the
   answer is right. It is the argument for the feature, so it gets to
   look like one. */
.dual-note{font-size:13px;line-height:1.6;color:var(--text2);text-align:center;
  margin-top:14px;padding:12px 14px;border-radius:12px;
  background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);}
/* The bolded half is the part that changes behaviour. Left uniformly
   grey it reads as a footnote, and a footnote is what got skipped. */
.dual-note b{color:#fff;}
.dual-note.good{color:var(--green);font-weight:700;}
/* The first line is the one that changes behaviour, so it is allowed
   to be louder than the explanation that follows it. */
/* ===== VERIFIED AGAINST THE CATALOG =====
   Shown only when it disagrees.

   A green "verified" tick on every correct scan is noise — people stop
   seeing a badge that always says yes, and then it says nothing on the
   one scan where it matters. The useful case is the catalog saying this
   card number is not in this set, which is what a misread looks like
   from the outside.

   Worded as a doubt, not a correction. The catalog can be wrong too,
   and quietly overwriting the read would leave somebody with a
   confident answer they had no way to question. */
/* ===== HOW THESE SALES HAPPENED =====
   An auction ending at $14.50 and a Buy It Now at $14.50 are not the
   same fact. One is several people converging on a price; the other is
   one person accepting one seller's number. A median built entirely
   from fixed-price listings is closer to an asking price than it looks.

   A bar rather than percentages, because the shape is the reading. */
.mix{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);}
.mix-bar{display:flex;height:6px;border-radius:100px;overflow:hidden;background:var(--surface2);}
.mix-bar i{display:block;}
.mix-key{display:flex;gap:12px;flex-wrap:wrap;margin-top:7px;
  font-family:var(--fm);font-size:9.5px;color:var(--text3);}
.mix-key span{display:inline-flex;align-items:center;gap:5px;}
.mix-key i{width:7px;height:7px;border-radius:2px;display:inline-block;}
.mix-note{font-family:var(--fm);font-size:10.5px;line-height:1.65;color:var(--text3);margin-top:7px;}
.mix-note.warn{color:var(--gold-warm);}

.vwarn{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px 14px;
  border-radius:10px;background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.34);
  font-size:12.5px;line-height:1.55;color:var(--gold-warm);}
.vwarn .ico{flex-shrink:0;font-size:14px;line-height:1.3;}
.vwarn b{color:#fff;}
.vwarn .fix{display:block;margin-top:6px;color:var(--text3);font-family:var(--fm);font-size:10.5px;}

.dual-note .hot{color:var(--green);font-size:14.5px;font-weight:800;display:inline-block;
  margin-bottom:5px;letter-spacing:-.1px;}

input[type=file]{display:none;}
.scanframe{position:relative;width:118px;height:164px;margin:0 auto 16px;border-radius:10px;background:linear-gradient(180deg,rgba(34,197,94,.05),rgba(34,197,94,.01));}
.scanframe .corner{position:absolute;width:28px;height:28px;border:3px solid var(--green);}
.scanframe .tl{top:0;left:0;border-right:none;border-bottom:none;border-top-left-radius:8px;}
.scanframe .tr{top:0;right:0;border-left:none;border-bottom:none;border-top-right-radius:8px;}
.scanframe .bl{bottom:0;left:0;border-right:none;border-top:none;border-bottom-left-radius:8px;}
.scanframe .br{bottom:0;right:0;border-left:none;border-top:none;border-bottom-right-radius:8px;}
.scanframe .scanline{position:absolute;z-index:3;left:8px;right:8px;height:2px;top:8px;background:linear-gradient(90deg,transparent,var(--green),transparent);box-shadow:0 0 10px 2px rgba(34,197,94,.55);border-radius:2px;animation:scanSweep 2.4s ease-in-out infinite;}
@keyframes scanSweep{0%{top:8px;opacity:0;}12%{opacity:1;}50%{top:calc(100% - 10px);opacity:1;}88%{opacity:1;}100%{top:8px;opacity:0;}}
/* The placeholder card. Drawn rather than an emoji so it reads as an
   actual trading card at a glance: refractor sheen, a player silhouette,
   a nameplate and a serial number. */
.scanframe .fcard{position:absolute;inset:9px;border-radius:7px;overflow:hidden;opacity:.42;
  background:linear-gradient(158deg,#12222f 0%,#0b1622 55%,#122536 100%);
  border:1px solid rgba(148,163,184,.13);}
.scanframe .fcard::after{content:'';position:absolute;inset:0;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 15px);}
.scanframe .holo{position:absolute;inset:0;mix-blend-mode:screen;
  background:linear-gradient(118deg,transparent 24%,rgba(34,197,94,.13) 40%,
    rgba(120,200,255,.09) 50%,rgba(245,158,11,.08) 60%,transparent 74%);}
.scanframe .bust{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);
  width:52px;height:60px;}
.scanframe .bust i{position:absolute;left:50%;top:0;transform:translateX(-50%);
  width:21px;height:22px;border-radius:52% 52% 46% 46%;display:block;
  background:linear-gradient(180deg,rgba(234,240,246,.30),rgba(234,240,246,.12));}
.scanframe .bust b{position:absolute;left:0;right:0;bottom:0;height:36px;display:block;
  background:linear-gradient(180deg,rgba(234,240,246,.20),rgba(234,240,246,.04));
  clip-path:polygon(34% 0%,66% 0%,100% 44%,100% 100%,0% 100%,0% 44%);
  border-radius:4px 4px 0 0;}
.scanframe .plate{position:absolute;left:11px;right:11px;bottom:10px;}
.scanframe .plate u{display:block;height:5px;width:72%;border-radius:2px;
  background:var(--green);opacity:.55;text-decoration:none;}
.scanframe .plate s{display:block;height:3px;width:44%;border-radius:2px;margin-top:4px;
  background:rgba(234,240,246,.2);text-decoration:none;}
.scanframe .serial{position:absolute;top:7px;right:8px;font-family:var(--fm);
  font-size:8px;letter-spacing:.06em;color:var(--green);opacity:.5;}
.scan-btn{width:100%;margin-top:14px;padding:15px;border-radius:12px;border:none;background:var(--green);color:#052e16;font-family:var(--f);font-size:15px;font-weight:800;cursor:pointer;display:none;align-items:center;justify-content:center;gap:8px;transition:all .2s;}
.scan-btn:hover{background:#16a34a;}
.scan-btn:disabled{opacity:.6;cursor:not-allowed;}
.or-line{text-align:center;font-family:var(--fm);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin:18px 0;position:relative;}
.or-line::before,.or-line::after{content:'';position:absolute;top:50%;width:36%;height:1px;background:var(--border);}
.or-line::before{left:0;}.or-line::after{right:0;}
.search-row{display:flex;gap:8px;}
.search-row input{flex:1;padding:13px 15px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-size:14px;font-weight:600;outline:none;}
.search-row input:focus{border-color:var(--green);}
.search-row button{padding:0 22px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-family:var(--f);font-size:14px;font-weight:800;cursor:pointer;white-space:nowrap;}
.search-hint{font-family:var(--fm);font-size:10.5px;color:var(--text3);text-align:center;margin-top:9px;line-height:1.5;}
.status{margin-top:14px;padding:12px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;display:none;align-items:center;justify-content:center;gap:9px;}
.status.show{display:flex;}
.status.loading{background:rgba(59,130,246,.1);color:var(--blue);}
.status.error{background:rgba(239,68,68,.1);color:var(--red);}
.spinner{width:14px;height:14px;border:2px solid rgba(59,130,246,.25);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.result{margin-top:4px;}
.rcard{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;animation:fadeIn .4s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.rtop{display:flex;gap:14px;padding:20px;border-bottom:1px solid var(--border);}
.rimg{width:66px;height:92px;border-radius:8px;object-fit:contain;background:#000;border:1px solid var(--border2);flex-shrink:0;}
.rimg-ph{width:66px;height:92px;border-radius:8px;background:var(--surface2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:30px;flex-shrink:0;}
.rname{font-weight:800;font-size:16px;line-height:1.25;margin-bottom:4px;}
.rmeta{font-family:var(--fm);font-size:11px;color:var(--text3);}
.rprices{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);}
.rpbox{background:var(--surface);padding:16px 10px;text-align:center;}
.rplabel{font-family:var(--fm);font-size:9px;letter-spacing:1px;color:var(--text3);margin-bottom:5px;}
.rpval{font-family:var(--fbig);font-size:22px;letter-spacing:0.5px;}
.rpval.main{color:var(--green);} .rpval.low{color:var(--text2);} .rpval.high{color:var(--gold-warm);}
.rpsub{font-family:var(--fm);font-size:8.5px;color:var(--text3);margin-top:4px;letter-spacing:.5px;}
/* ===== SOLD PRICES — the real answer, the headline ===== */
.sold-hero{background:linear-gradient(160deg,rgba(34,197,94,.16),rgba(11,22,34,.5));
  border:1.5px solid rgba(34,197,94,.5);border-radius:14px;padding:22px 18px;margin-top:12px;
  box-shadow:0 0 36px rgba(34,197,94,.10);}
.sold-hero-lbl{font-family:var(--fm);font-size:11px;font-weight:700;letter-spacing:2.4px;
  text-transform:uppercase;color:var(--green);margin-bottom:9px;display:flex;align-items:center;gap:6px;}

/* This is the number people came for.

   Every other figure on the page is context: what sellers hope for, what
   a grade might fetch, what the range looks like. This one is what buyers
   actually paid, and collectors quote it to each other as the comp. It was
   set at the same weight as the asking prices below it, which buried the
   answer in its own supporting evidence. It now reads as the headline it
   is — larger than anything else on the result, and green, so the eye
   lands on it before the asks. */
.sold-hero-val{font-family:var(--fbig);font-size:clamp(52px,15vw,78px);line-height:.9;
  color:var(--green);letter-spacing:.5px;text-shadow:0 0 34px rgba(34,197,94,.28);}
.sold-hero.thin{border-color:rgba(148,163,184,.35);background:rgba(30,41,59,.35);}
.sold-hero.thin .sold-hero-lbl{color:#94a3b8;}
.sold-hero-est{color:#cbd5e1;}
/* Above the number, not below it. A person who reads only the big
   figure has still been told it is for a different card. */
.broadened{border:1px solid rgba(245,158,11,.34);background:rgba(245,158,11,.08);
  border-radius:9px;padding:9px 11px;margin:8px 0 10px;font-size:12.5px;
  line-height:1.55;color:var(--gold-warm,#fbbf24);}
.broadened b{color:#fde68a;}
.broadened-q{font-family:var(--fm);font-size:11.5px;color:var(--text2);
  overflow-wrap:anywhere;}
/* Quiet by design. It is a clarification, not a warning -- the page
   already has enough amber on it. */
.price-scope{font-family:var(--fm);font-size:10.5px;color:var(--text3);
  margin-top:5px;letter-spacing:.01em;}
.sold-hero-sub{font-family:var(--fm);font-size:11px;color:var(--dim);margin-top:8px;line-height:1.5;}
.sold-hero-sub b{color:var(--text2);}
.sold-range{display:inline-flex;gap:5px;margin-top:9px;font-family:var(--fm);font-size:11px;
  color:var(--text3);}
.sold-range b{color:var(--text2);}
.sold-range.hidden{display:none;}
.sold-basis{display:inline-block;margin-left:10px;vertical-align:middle;padding:2px 8px;border-radius:100px;font-size:9px;
  font-family:var(--fm);letter-spacing:.05em;background:rgba(34,197,94,.14);color:var(--green);}
/* CATALOG VERIFICATION — POSITIVE CASE.
   buildVerifyWarning already handles the negative case (a card number
   that doesn't match anything real, or matches the wrong player) with
   a prominent amber box. This is its quiet counterpart: when the
   catalog checked and everything lined up, say so in one small line
   rather than saying nothing. A scanner that only ever speaks up when
   something's wrong reads as silent-by-default, which is a much
   weaker trust signal than a visible "we checked, it's right." */
.vgood{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:3px 9px;border-radius:100px;
  font-size:10.5px;font-family:var(--f);font-weight:700;background:rgba(34,197,94,.1);
  border:1px solid rgba(34,197,94,.28);color:#86efac;}
/* A range many multiples wide isn't a range, it's a warning that the query
   is pulling in more than one card. Say that instead of printing the number
   and letting it undercut the median sitting right above it. */
.sold-spread{margin-top:11px;padding:11px 12px;border-radius:10px;
  background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.32);}
.sold-spread-t{font-size:11.5px;font-weight:700;color:var(--gold-warm);line-height:1.5;}
.sold-range-toggle{margin-top:9px;font-family:var(--fm);font-size:10px;letter-spacing:.09em;
  color:var(--text3);background:transparent;border:1px solid var(--border2);border-radius:100px;
  padding:5px 11px;cursor:pointer;transition:all .18s;}
.sold-range-toggle:hover{border-color:var(--gold);color:var(--gold);}

/* ===== REFINEMENT CHIPS =====
   Shown only when the spread warning fires. Every chip is built from a
   count that came back in this payload, so we never offer a filter that
   leads to an empty result. One active at a time — "PSA 10 + raw only"
   is a contradiction, not a refinement. */
.refine{margin-top:12px;background:var(--surface2);border:1px solid var(--border);
  border-radius:11px;padding:13px 14px;}
.refine-lbl{font-family:var(--fm);font-size:9.5px;letter-spacing:1.6px;text-transform:uppercase;
  color:var(--text3);margin-bottom:10px;}
.refine-chips{display:flex;flex-wrap:wrap;gap:7px;}
.refine-chip{font-family:var(--fm);font-size:11px;font-weight:600;padding:8px 13px;
  border-radius:100px;border:1px solid var(--border2);background:var(--surface);
  color:var(--text2);cursor:pointer;transition:all .16s;line-height:1.2;}
.refine-chip:hover{border-color:var(--green);color:var(--green);}
.refine-chip:disabled{opacity:.55;cursor:not-allowed;}
.refine-chip b{color:var(--text);font-weight:800;}
.refine-chip .n{color:var(--text3);font-weight:400;}
.refine-chip.on{border-color:var(--green);background:rgba(34,197,94,.12);color:var(--green);}
.refine-chip.on b,.refine-chip.on .n{color:var(--green);}
.refine-chip.undo{border-color:var(--border2);color:var(--text3);}
.refine-chip.undo:hover{border-color:var(--gold);color:var(--gold);}
.refine-state{font-size:11.5px;line-height:1.5;color:var(--text2);margin-bottom:10px;}
.refine-state b{color:var(--green);}
.refine-thin{font-size:11.5px;line-height:1.5;font-weight:700;color:var(--gold-warm);
  background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.3);
  border-radius:9px;padding:9px 11px;margin-bottom:10px;}

/* ask-vs-sold bar */
.avs{margin-top:12px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;
  padding:13px 15px;}
.avs-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:9px;}
.avs-side{text-align:center;flex:1;}
.avs-k{font-family:var(--fm);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;
  color:var(--text3);margin-bottom:4px;}
.avs-v{font-family:var(--fbig);font-size:22px;letter-spacing:.5px;}
.avs-v.ask{color:var(--gold-warm);} .avs-v.sold{color:var(--green);}
.avs-track{height:8px;border-radius:100px;background:var(--surface3);overflow:hidden;position:relative;}
.avs-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--green),var(--gold-warm));}
.avs-note{font-size:11.5px;line-height:1.5;font-weight:600;margin-top:10px;text-align:center;}
.avs-note.over{color:var(--gold-warm);} .avs-note.under{color:var(--green);} .avs-note.fair{color:var(--text2);}

.sold-check{display:block;text-decoration:none;background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(59,130,246,.04));border-top:1px solid rgba(59,130,246,.28);border-bottom:1px solid rgba(59,130,246,.28);padding:14px 16px;text-align:center;transition:all .2s;}
/* REAL LISTING THUMBNAILS -- see buildListingThumbs() for why. */
.lthumbs-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-warm,#fbbf24);margin:14px 0 8px;padding:0 2px;}
.lthumbs{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 6px;-webkit-overflow-scrolling:touch;}
.lthumb{flex:0 0 92px;text-decoration:none;position:relative;display:block;}
.lthumb img{width:92px;height:122px;object-fit:cover;border-radius:10px;background:var(--surface2,#1a2235);border:0.5px solid var(--surface3,#212d42);display:block;}
.lthumb-price{display:block;margin-top:6px;font-size:14px;font-weight:600;color:var(--green,#22c55e);}
.lthumb-badge{position:absolute;top:6px;left:6px;background:rgba(10,14,26,.85);color:var(--gold-warm,#fbbf24);font-size:10px;padding:2px 6px;border-radius:6px;font-weight:600;}
.sold-check:hover{background:rgba(59,130,246,.18);}
.sold-check-main{display:block;font-family:var(--f);font-size:14px;font-weight:800;color:var(--blue);letter-spacing:.2px;}
.sold-check-sub{display:block;font-family:var(--fm);font-size:10px;color:var(--text3);margin-top:5px;line-height:1.5;}
/* The check-our-work link. Visible, permanent, deliberately quieter than
   the shop link above it — trust, not traffic. */
.verify-link{display:block;text-decoration:none;text-align:center;
  font-family:var(--fm);font-size:11px;font-weight:600;color:var(--text2);
  background:rgba(59,130,246,.04);border-bottom:1px solid rgba(59,130,246,.28);
  padding:11px 16px;transition:all .18s;}
.verify-link:hover{color:var(--blue);background:rgba(59,130,246,.1);}
/* Disclosure belongs beside the link it describes, not only in the footer. */
.aff-note{text-align:center;font-family:var(--fm);font-size:9.5px;line-height:1.5;
  color:var(--text3);padding:8px 16px 9px;background:rgba(0,0,0,.16);}
.rnodata{padding:18px 16px;text-align:center;font-size:13px;color:var(--gold);background:rgba(245,158,11,.06);line-height:1.65;}
.rnodata b{color:var(--gold-warm);font-size:14px;}
.rnodata-eg{display:inline-block;margin-top:8px;font-family:var(--fm);font-size:11.5px;color:var(--text2);background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:7px 12px;}
.rsplit{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);border-top:1px solid var(--border);}
.rsplit-box{background:var(--surface2);padding:14px 12px;text-align:center;}
.rsplit-lbl{font-family:var(--fm);font-size:9px;letter-spacing:1.5px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;}
.rsplit-val{font-family:var(--fbig);font-size:20px;letter-spacing:.5px;color:var(--text);}
.rsplit-sub{font-family:var(--fm);font-size:9.5px;color:var(--text3);margin-top:4px;}
.rparallel{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:100px;background:rgba(168,85,247,.14);border:1px solid rgba(168,85,247,.4);font-family:var(--fm);font-size:10px;font-weight:700;color:#c084fc;letter-spacing:.5px;}
/* COMPGUARD. The sales that were left out, and why.

   Collapsed by default and deliberately quiet -- this is a receipt, not
   an alarm. The headline number above already carries the claim; this
   is the working shown underneath it for anyone who wants to check. */
.cgline{margin-top:9px;font-family:var(--fm);font-size:11px;color:var(--text3);
  cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:5px;}
.cgline:hover{color:var(--text2);}
.cgline b{color:#4ade80;font-weight:700;}
.cgline .arw{font-size:9px;transition:transform .18s;display:inline-block;}
.cgline.open .arw{transform:rotate(90deg);}
.cgbody{display:none;margin-top:9px;border-top:1px solid rgba(255,255,255,.08);padding-top:9px;}
.cgbody.open{display:block;}
.cgrow{display:flex;justify-content:space-between;gap:12px;padding:4px 0;
  font-family:var(--fm);font-size:11px;color:var(--text2);line-height:1.5;}
.cgrow span:last-child{color:var(--text3);white-space:nowrap;}
.cgfoot{font-family:var(--fm);font-size:10px;color:var(--text3);line-height:1.55;
  margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);}
/* THE VARIANT CHOOSER.

   The server has ranked candidate parallels on every scan since the
   prompt asked for them, and both scanners threw the list away. This
   is the panel that shows it. Styled as a question, not a warning --
   the scanner is not broken here, it is doing the honest thing and
   saying which ones it cannot separate. */
.pvbox{margin-top:11px;border:1px solid rgba(168,85,247,.32);border-radius:12px;
  background:rgba(168,85,247,.06);padding:12px 13px;}
.pvbox-t{font-family:var(--fm);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;
  color:#c084fc;margin-bottom:7px;}
.pvbox-p{font-size:12.5px;line-height:1.55;color:var(--text2);margin-bottom:10px;}
.pvbox-p b{color:var(--text);}
.pvrow{display:flex;flex-wrap:wrap;gap:6px;}
.pvopt{font-family:var(--fm);font-size:11.5px;font-weight:700;padding:8px 13px;border-radius:100px;
  border:1px solid rgba(168,85,247,.4);background:rgba(168,85,247,.10);color:#e9d5ff;
  cursor:pointer;transition:all .15s;}
.pvopt:hover{background:rgba(168,85,247,.22);border-color:#c084fc;}
.pvopt.on{background:#c084fc;border-color:#c084fc;color:#1a0b2e;}
.pvopt.base{border-style:dashed;color:var(--text2);background:transparent;}
.pvbox-note{font-family:var(--fm);font-size:10px;color:var(--text3);margin-top:9px;line-height:1.5;}
.roi{padding:20px;border-top:1px solid var(--border);}
.roi-head{font-family:var(--fm);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--gold);margin-bottom:14px;text-align:center;}
.roi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.roi-cell{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center;}
.roi-cell.real{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.06);}
.roi-grade{font-family:var(--fbig);font-size:15px;color:var(--text);}
.roi-val{font-family:var(--fm);font-size:14px;font-weight:600;color:var(--green);margin-top:4px;}
.roi-mult{font-family:var(--fm);font-size:9px;color:var(--text3);margin-top:2px;}
.roi-mult.real{color:var(--green);font-weight:700;}
.roi-note{font-size:11px;color:var(--text3);text-align:center;margin-top:12px;line-height:1.5;}

/* ===== ADD THE BACK — shown only when a PHOTO scan came back uncertain ===== */
.backask{border-top:1px solid var(--line);background:rgba(59,130,246,.07);padding:15px 16px;}
.backask-q{font-size:13px;font-weight:800;color:var(--bone);margin-bottom:5px;}
.backask-sub{font-size:11.5px;color:var(--dim);line-height:1.5;margin-bottom:11px;}
.backask-btn{display:block;width:100%;padding:12px;border-radius:10px;border:none;
  background:var(--blue);color:#fff;font-family:var(--f);font-size:13.5px;font-weight:800;
  cursor:pointer;text-align:center;transition:all .18s;}
.backask-btn:hover{filter:brightness(1.1);}
.backask-btn:disabled{opacity:.6;cursor:not-allowed;}
.backask-thumb{max-width:72px;max-height:100px;border-radius:6px;border:1px solid var(--border2);
  display:block;margin:0 auto 10px;}

/* ===== SELL ONE LIKE THIS =====
   Deliberately NOT a third blue bar. Two eBay links are already stacked
   here, and a third identical one turns a hierarchy into a wall — the
   eye stops telling them apart and taps none of them.

   Green because this is the one link on the page where money moves
   TOWARD the person reading. That is a different kind of action from
   the two above it, and colour is the cheapest way to say so. */
.sell{display:block;text-decoration:none;padding:15px 16px;
  background:linear-gradient(135deg,rgba(34,197,94,.14),rgba(34,197,94,.03));
  border-top:1px solid rgba(34,197,94,.3);border-bottom:1px solid rgba(34,197,94,.3);
  transition:background .18s;}
.sell:hover{background:rgba(34,197,94,.2);}
.sell-row{display:flex;align-items:center;gap:12px;}
.sell-main{flex:1;font-family:var(--f);font-size:14px;font-weight:800;
  color:var(--green);letter-spacing:.2px;line-height:1.35;}
.sell-go{font-family:var(--fbig);font-size:22px;color:var(--green);line-height:1;}
.sell-sub{display:block;font-family:var(--fm);font-size:9.5px;color:var(--text3);
  margin-top:6px;line-height:1.6;}
.sell-sub b{color:var(--text2);}

/* The state that matters more than the happy path. Handing somebody a
   number to list at, directly under a warning that we cannot tell which
   card the number describes, would be talking them into mispricing
   their own card in the one place they were most likely to trust us. */
.sell-off{padding:13px 16px;background:rgba(0,0,0,.2);
  border-top:1px solid var(--border);font-family:var(--fm);font-size:10px;
  line-height:1.7;color:var(--text3);text-align:center;}
.sell-off b{color:var(--gold-warm);}

/* The badge has to change colour when the label stops being true. A
   green RAW tag over a median the server has flagged as mixed is the
   page vouching for a number it was just told not to trust. */
.sold-basis.mixed{background:rgba(245,158,11,.16);color:var(--gold-warm);}
/* THE NUMBER ITSELF, not just the badge.

   Recolouring the pill and leaving the headline green meant the
   loudest element on the page stayed in the trusted colour while a
   small tag beside it said don't trust it. On a phone the badge is
   read second, if at all — people see a big green number and stop.

   Colour is doing the same job here as the words: this figure is not
   one you should act on. It has to look like the warning it is. */
.sold-hero.mixed{background:linear-gradient(160deg,rgba(245,158,11,.14),rgba(11,22,34,.5));
  border-color:rgba(245,158,11,.5);box-shadow:0 0 36px rgba(245,158,11,.08);}
.sold-hero.mixed .sold-hero-lbl{color:var(--gold-warm);}
.sold-hero.mixed .sold-hero-val{color:var(--gold-warm);
  text-shadow:0 0 34px rgba(245,158,11,.22);}
.sold-mixed{margin-top:11px;padding:11px 12px;border-radius:10px;
  background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.32);
  font-size:11.5px;line-height:1.55;color:var(--gold-warm);}
.sold-mixed b{color:#fff;}

/* ===== THE SESSION BENCH =====
   The page calls itself a workstation. A first-time visitor saw a
   scanner that answered one question and forgot it, which is a lookup
   tool with a bigger headline.

   The obvious fix is a logged-in dashboard, and it is the wrong first
   move: two people have saved anything, so a returning-collector view
   would be an empty box on almost every visit, and an empty bench is
   worse than no bench.

   This works at the traffic that actually exists. The bench assembles
   itself out of what somebody looks up in the session they are already
   in — no login, no empty state — and by the second card the page is
   visibly doing something no lookup tool does.

   It also moves the save ask to the only moment it is obviously worth
   saying yes to: after the work exists, rather than under the first
   result somebody has no reason to keep yet. */
.bench{border:1px solid rgba(245,158,11,.32);border-radius:var(--radius-lg);
  background:linear-gradient(160deg,rgba(245,158,11,.07),rgba(17,24,39,.55));
  overflow:hidden;margin-top:13px;}
.bench-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  padding:13px 15px 10px;border-bottom:1px solid var(--border);flex-wrap:wrap;}
.bench-t{font-size:13.5px;font-weight:800;color:var(--text);}
.bench-t span{color:var(--gold-warm);font-weight:600;}
.bench-n{font-family:var(--fm);font-size:10px;color:var(--text3);}
.brow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;
  padding:10px 15px;border-bottom:1px solid var(--border);}
.brow:last-of-type{border-bottom:none;}
/* The card just looked up is marked. On the fifth lookup "which one
   did I just do" stops being obvious without it. */
.brow.now{background:rgba(245,158,11,.05);}
.bname{font-size:12px;color:var(--text);line-height:1.35;min-width:0;overflow-wrap:anywhere;}
.bname span{display:block;font-family:var(--fm);font-size:9px;color:var(--text3);margin-top:3px;}
.bname .tick{color:var(--green);font-weight:800;margin-right:5px;}
.bval{font-family:var(--fm);font-size:12.5px;font-weight:700;color:var(--green);
  text-align:right;white-space:nowrap;}
.bval.warn{color:var(--gold-warm);}
.bval small{display:block;font-size:8.5px;font-weight:400;color:var(--text3);margin-top:2px;}
.btot{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  padding:12px 15px;background:rgba(0,0,0,.26);border-top:1px solid var(--border);flex-wrap:wrap;}
.btot-k{font-family:var(--fm);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text2);}
.btot-v{font-family:var(--fbig);font-size:24px;color:var(--gold-warm);line-height:1;}
.bench-cta{padding:12px 15px;background:rgba(34,197,94,.07);
  border-top:1px solid rgba(34,197,94,.25);}
.bench-btn{display:block;width:100%;padding:12px;border-radius:10px;border:none;
  background:var(--green);color:#052e16;font-family:var(--f);font-size:13.5px;
  font-weight:800;cursor:pointer;text-align:center;text-decoration:none;}
.bench-btn:disabled{opacity:.6;cursor:not-allowed;}
.bench-btn.done{background:var(--surface2);border:1px solid rgba(34,197,94,.4);color:var(--green);}
.bench-fine{font-family:var(--fm);font-size:9px;line-height:1.65;color:var(--text3);
  text-align:center;margin-top:8px;}
.bench-fine b{color:var(--text2);}
.bench-clear{display:block;width:100%;text-align:center;background:none;border:none;
  font-family:var(--fm);font-size:9px;letter-spacing:.08em;color:var(--text3);
  padding:9px 0 4px;cursor:pointer;text-decoration:underline;}
.bench-clear:hover{color:var(--text2);}

/* ===== PRICE NOTE ===== */
.pnote{padding:12px 16px;font-size:12px;line-height:1.5;font-weight:600;
  display:flex;gap:8px;align-items:flex-start;
  background:rgba(245,158,11,.09);border-top:1px solid rgba(245,158,11,.3);
  border-bottom:1px solid rgba(245,158,11,.3);color:var(--gold-warm);}
.pnote .ico{flex-shrink:0;}

/* ===== SCAN FEEDBACK ===== */
.fb{border-top:1px solid var(--border);padding:16px 18px;text-align:center;}
.fb-q{font-size:13.5px;font-weight:800;color:var(--text);margin-bottom:12px;}
.fb-row{display:flex;gap:10px;justify-content:center;}
.fb-btn{flex:0 0 auto;min-width:86px;padding:11px 18px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-size:15px;font-weight:800;cursor:pointer;transition:all .18s;}
.fb-btn:hover{border-color:var(--gold);color:var(--gold);}
.fb-btn.up:hover{border-color:var(--green);color:var(--green);}
.fb-reasons{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;}
.fb-reason{padding:9px 14px;border-radius:100px;border:1px solid var(--border2);background:var(--surface2);color:var(--text3);font-family:var(--fm);font-size:11px;letter-spacing:.06em;cursor:pointer;transition:all .18s;}
.fb-reason:hover{border-color:var(--red);color:#ff8f86;}
.fb-thanks{font-size:13px;color:var(--text2);line-height:1.6;}
.fb-thanks b{color:var(--gold);}
.fb-sub{font-size:11px;color:var(--text3);margin-top:10px;line-height:1.5;}

/* ===== SEARCH-WE-RAN BOX ===== */
.sq{border-top:1px solid var(--border);background:rgba(245,158,11,.04);padding:18px 18px 20px;}
.sq-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.sq-label{font-family:var(--fm);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--gold);}
.sq-edit{font-family:var(--fm);font-size:10px;font-weight:600;letter-spacing:1px;color:var(--text2);background:var(--surface2);border:1px solid var(--border2);border-radius:100px;padding:6px 13px;cursor:pointer;transition:all .2s;}
.sq-edit:hover{border-color:var(--gold);color:var(--gold);}
.sq.flagged{background:rgba(245,158,11,.09);}
.sq.flagged .sq-edit{border-color:var(--gold);color:var(--gold);}
.sq-text{font-family:var(--fm);font-size:12px;line-height:1.6;color:var(--text);background:rgba(0,0,0,.32);border:1px solid var(--border);border-radius:9px;padding:11px 12px;margin-top:11px;word-break:break-word;}
.sq-broad{margin-top:11px;font-size:12px;line-height:1.6;color:#fbbf24;}
.sq-input{width:100%;font-family:var(--fm);font-size:12px;line-height:1.6;color:var(--text);background:rgba(0,0,0,.42);border:1px solid var(--gold);border-radius:9px;padding:11px 12px;margin-top:11px;outline:none;}
.sq-go{width:100%;margin-top:10px;padding:13px;border-radius:10px;border:none;background:var(--gold);color:#1a1206;font-family:var(--f);font-size:14px;font-weight:800;cursor:pointer;transition:all .2s;}
.sq-go:hover{background:var(--gold-warm);}
.sq-go:disabled{opacity:.6;cursor:not-allowed;}
.sq-link{display:inline-block;margin-top:11px;font-family:var(--fm);font-size:11.5px;font-weight:600;color:var(--blue);text-decoration:none;}
.sq-link:hover{text-decoration:underline;}
.sq-why{font-size:11px;color:var(--text3);margin-top:9px;line-height:1.55;}
.sq-why b{color:var(--text2);}

/* ===== ADD TO HOME SCREEN =====
   Only ever shown after a result, because a stranger has no reason to
   install anything before they've seen it work once. */
.install{display:none;margin-top:18px;padding:18px 20px;border-radius:var(--radius-lg);
  background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(34,197,94,.03));
  border:1px solid rgba(34,197,94,.35);}
.install.show{display:block;}
.install-t{font-family:var(--fbig);font-size:21px;letter-spacing:.5px;color:var(--text);
  line-height:1.1;margin-bottom:7px;}
.install-s{font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:15px;}
.install-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;}
.install-btn{flex:1;min-width:150px;padding:13px 18px;border-radius:11px;border:none;
  background:var(--green);color:#052e16;font-family:var(--f);font-size:14.5px;font-weight:800;
  cursor:pointer;transition:all .18s;}
.install-btn:hover{background:#16a34a;}
.install-x{padding:13px 16px;border-radius:11px;border:1px solid var(--border2);
  background:transparent;color:var(--text3);font-family:var(--fm);font-size:11px;
  letter-spacing:.08em;cursor:pointer;transition:all .18s;}
.install-x:hover{border-color:var(--text3);color:var(--text2);}
.install-steps{font-size:12.5px;color:var(--text2);line-height:1.7;}
.install-steps b{color:var(--text);}
.install-steps .k{display:inline-block;font-family:var(--fm);font-size:11px;
  background:var(--surface2);border:1px solid var(--border2);border-radius:6px;
  padding:2px 7px;color:var(--text);}

/* ===== BOTTOM CTA (toolkit, no coins) ===== */
.cg-cta{background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.35);border-radius:var(--radius-lg);padding:24px;text-align:center;margin-top:18px;}
.cg-cta-eyebrow{font-family:var(--fm);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:10px;}
.cg-cta h3{font-family:var(--fbig);font-size:24px;color:var(--text);letter-spacing:0.5px;margin-bottom:8px;line-height:1.05;}
.cg-cta p{font-size:13.5px;color:var(--text2);line-height:1.55;margin-bottom:16px;max-width:38ch;margin-left:auto;margin-right:auto;}
.cg-cta-tools{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:18px;}
.cg-cta-chip{font-family:var(--fm);font-size:11px;font-weight:600;padding:7px 13px;border-radius:100px;border:1px solid var(--border2);background:var(--surface);color:var(--text2);}
.cg-cta-btn{display:inline-block;background:var(--gold);color:var(--bg);font-family:var(--f);font-weight:800;font-size:15px;padding:14px 30px;border-radius:12px;text-decoration:none;transition:all .2s;}
.cg-cta-btn:hover{background:var(--gold-warm);transform:translateY(-2px);box-shadow:0 8px 24px rgba(245,158,11,.35);}
.cg-cta-alt{display:block;text-align:center;margin-top:11px;font-family:var(--fm);
  font-size:12px;color:var(--gold-warm);text-decoration:none;opacity:.85;}
.cg-cta-alt:hover{opacity:1;text-decoration:underline;}
/* ===== KEEP IT ON YOUR PHONE =====
   The install offer used to live at the very bottom of the home page,
   which is where nobody scrolls unless they are already sold.

   The moment it actually means something is right after a result:
   somebody has just got a real number, they are thinking that was
   useful, and "keep this handy" is an obvious yes rather than a demand.
   Before that it is asking for commitment ahead of value, and it sends
   them to a different domain where they will be signed out.

   So it appears only under a result, and only on a phone \u2014 telling
   somebody at a desktop to add it to their home screen is noise. */
.cg-keep{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;
  margin-top:14px;padding-top:14px;border-top:1px solid var(--border);
  font-family:var(--fm);font-size:11.5px;color:var(--text3);line-height:1.6;text-align:center;}
.cg-keep b{color:var(--text2);}
.cg-keep a{color:var(--green);text-decoration:none;font-weight:700;white-space:nowrap;
  border:1px solid rgba(34,197,94,.35);border-radius:100px;padding:7px 15px;
  background:rgba(34,197,94,.08);}
.cg-keep a:hover{background:rgba(34,197,94,.16);}
/* Shown on desktop too. Hiding it there was tidier in theory and
   confusing in practice — somebody at a laptop can still learn the
   phone version exists, and a line that only appears on some devices
   is one nobody can verify is working. */

.cg-cta-foot{font-family:var(--fm);font-size:10.5px;color:var(--text3);margin-top:12px;letter-spacing:.04em;}
.cg-cta h3 br{line-height:1.2;}
.foot{text-align:center;padding:30px 20px;color:var(--text3);font-size:12px;line-height:1.7;}
.foot a{color:var(--gold);text-decoration:none;font-weight:700;}
.foot-links{display:flex;gap:16px;justify-content:center;margin-bottom:12px;flex-wrap:wrap;}
.foot-links a{color:var(--text2);font-family:var(--fm);font-size:11px;font-weight:600;}
/* Two small asks in the footer, and deliberately only two.

   This page's whole advantage over the full site is that it is fast and
   uncluttered — somebody installed it to price a card standing at a
   table. Stacking WorthGauge, the Shop and a Pro card in here would trade
   the one thing it has for cross-sells that already live on the site, one
   tap away through the panel above.

   So: the store, because whoever just priced a card might buy one, and
   the tip jar, because the tool is free and asking is honest. Both quiet,
   both below everything else. */
/* THE BUSINESS LINK, AS A NOTE RATHER THAN A BANNER.

   Three sizes in one day, and the reasoning changed each time for a
   reason. It started large because nothing else pointed at Business.
   It shrank because the footer, the guide and both scanner pages now
   do. This is the last step: 92% of visitors never scan a card, and
   the largest object between the headline and the capture slots was
   aimed at card shops -- perhaps one visitor in a hundred.

   A collector who taps a link from Instagram should meet the scanner,
   not an ad for software they will never buy. A shop owner reading
   the same line still sees it, because it sits above the fold and
   says exactly what it is.

   One line, same shape as the card-show tip below it. Gold instead of
   blue so it is distinguishable, and the arrow keeps it obviously
   tappable. */
/* THE ONLY BANNER HERE WITH A PAYING AUDIENCE BEHIND IT.

   Sized as a footnote: 10.5px monospace in a thin pill, the same weight
   as the set-builder line beside it. It earned 5 clicks in 30 days.

   A shop is the one visitor with a budget, and Business is the one
   surface with a price on it. Bigger type, a real card rather than a
   pill, and enough padding to read as a destination instead of a
   footnote. Same link, same event, same copy -- only the presence
   changes, so if it still does not convert that is the offer and not
   the styling. */
.biz-note{display:flex;align-items:center;gap:12px;text-align:left;text-decoration:none;
  background:rgba(245,158,11,.13);border:1.5px solid rgba(245,158,11,.5);border-radius:14px;
  padding:15px 18px;margin:18px auto 0;max-width:52ch;
  font-family:var(--fm);font-size:13px;line-height:1.6;color:var(--text2,#cbd5e1);transition:all .2s;}
.biz-note:hover{border-color:var(--gold);background:rgba(245,158,11,.14);}
.biz-note b{color:var(--gold);}
.biz-note-tag{flex-shrink:0;background:var(--gold);color:#1a1206;font-weight:900;
  font-size:11px;letter-spacing:.06em;padding:4px 10px;border-radius:6px;}
.biz-note-go{flex-shrink:0;color:var(--gold);font-weight:800;font-size:17px;margin-left:auto;}
@media(max-width:520px){ .biz-note{border-radius:14px;max-width:none;align-items:flex-start;font-size:12.5px;padding:14px 15px;} }

/* ── SET BUILDER ANNOUNCEMENT ───────────────────────────────────
   Green rather than the gold used by the shop banner and the blue
   used by the show-log tip, so three notices in a column read as
   three different things rather than a wall of banners.

   Deliberately NOT above the camera. The scanner is the product and
   the thing people came for; a feature announcement that pushes the
   camera down the page trades the working funnel for the unused one.
   This sits directly under the scan box, which is the first thing
   read after the reason they arrived. */
.cg-hint{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px;
  padding:8px 11px;border-radius:9px;cursor:pointer;
  background:rgba(59,130,246,.09);border:1px solid rgba(59,130,246,.28);
  font-family:var(--fm);font-size:11px;line-height:1.55;color:var(--text3);}
.cg-hint:hover{background:rgba(59,130,246,.16);}
.cg-hint b{color:var(--text2);}
.cg-hint-v{color:var(--blue,#3b82f6);font-weight:700;}
.cg-hint-go{margin-left:auto;color:var(--blue,#3b82f6);font-weight:700;white-space:nowrap;}

/* SHOWN, NOT HIDDEN.

   This was built as a drawer -- collapsed, 10.5px grey label, opened by
   tapping. The reasoning was sound at the time: the result screen fires
   six to fifteen elements and a chart nobody asked for is more of them.

   It was opened once in two days, by the owner. A drawer that nobody
   opens is not saving space, it is hiding the only picture of the
   evidence on the page -- twelve real sales with dates, which is the
   thing the whole product claims to be about.

   So it reads as a panel now: a heading in the text colour, the dates
   it covers, and the chart open underneath. The toggle stays, so
   anybody who wants it out of the way still gets that -- it is just no
   longer the default. */
.salesc{margin-top:12px;border-top:1px solid var(--line,#1e2d45);padding-top:12px}
.salesc-t{font-family:var(--fm);font-size:11.5px;letter-spacing:.08em;color:var(--text2,#94a3b8);
  font-weight:700;cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px}
.salesc-t:hover{color:var(--text,#f1f5f9)}
.salesc-t span{opacity:.55;margin-left:auto;font-size:10px}
.salesc-when{font-weight:400;opacity:.7;letter-spacing:.04em}
.salesc-k{font-family:var(--fm);font-size:10px;color:var(--text3,#64748b);margin-top:7px;text-align:center}
.set-note{display:flex;align-items:center;gap:9px;text-align:left;text-decoration:none;
  background:rgba(34,197,94,.09);border:1px solid rgba(34,197,94,.32);border-radius:100px;
  padding:9px 16px;margin:14px auto 0;max-width:44ch;
  font-family:var(--fm);font-size:10.5px;line-height:1.6;color:var(--text3);transition:all .2s;}
.set-note:hover{border-color:var(--green);background:rgba(34,197,94,.15);}
.set-note b{color:var(--green);}
.set-note-tag{flex-shrink:0;background:var(--green);color:#052e16;font-weight:900;
  font-size:9px;letter-spacing:.06em;padding:2px 7px;border-radius:5px;}
.set-note-go{flex-shrink:0;color:var(--green);font-weight:700;margin-left:auto;}
@media(max-width:520px){ .set-note{border-radius:12px;max-width:none;align-items:flex-start;} }
.show-tip{display:flex;align-items:flex-start;gap:9px;text-align:left;text-decoration:none;
  background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.26);border-radius:100px;
  padding:9px 16px;margin:14px auto 0;max-width:44ch;
  font-family:var(--fm);font-size:10.5px;line-height:1.6;color:var(--text3);transition:all .2s;}
.show-tip:hover{border-color:var(--blue);background:rgba(59,130,246,.13);}
.show-tip b{color:var(--blue);}
.show-tip-ico{flex-shrink:0;font-size:12px;line-height:1.4;}
.show-tip-go{flex-shrink:0;color:var(--blue);font-weight:700;align-self:center;}
/* Small, quiet text link -- this isn't trying to compete with the
   Business banner above for attention, it's just a low-friction way
   for an existing happy user to pass the site along. */
.share-link{display:inline-flex;align-items:center;gap:5px;margin-top:10px;
  background:none;border:none;font-family:var(--fm);font-size:11px;color:var(--muted);
  cursor:pointer;text-decoration:underline;padding:4px;}
.share-link:hover{color:var(--text);}
@media(max-width:520px){ .show-tip{border-radius:12px;max-width:none;} }
/* Deliberately much bigger and bolder than .show-tip -- that component
   is designed to be a quiet footnote-style tip, which is exactly what
   made the Business tool easy to scroll past before. This is meant to
   be the opposite: the first thing seen after the headline, sized and
   colored to actually compete with the H1 for attention rather than
   blend into the page around it. */
.biz-banner{display:flex;align-items:center;gap:16px;text-align:left;text-decoration:none;
  background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(245,158,11,.06));
  border:2px solid var(--gold);border-radius:18px;
  padding:11px 16px;margin:14px auto 0;max-width:640px;
  transition:all .2s;}
.biz-banner:hover{background:linear-gradient(135deg,rgba(245,158,11,.24),rgba(245,158,11,.1));
  transform:translateY(-1px);box-shadow:0 8px 24px rgba(245,158,11,.2);}
.biz-banner-ico{flex-shrink:0;font-size:26px;line-height:1;}
/* SHORTER, BECAUSE IT IS AIMED AT ALMOST NOBODY WHO ARRIVES.

   This was deliberately sized to compete with the headline, back when
   nothing else pointed at the Business tool. That was the right call
   then. It is now linked from the footer, the guide and both scanner
   pages, so it no longer has to shout.

   Meanwhile 92% of visitors never scan a card, and this was the
   largest thing standing between the headline and the capture slots --
   several lines of screen, on a phone, for a product aimed at card
   shops rather than the collector who just tapped a link.

   Four stacked lines become two, the icon drops, the padding halves.
   Same link, same tracking, same BETA badge inline rather than on its
   own row. Visible, no longer dominant. */
.biz-banner-body{flex:1;min-width:0;}
.biz-banner-k{font-family:var(--fm);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:2px;display:inline;}
/* A real, high-contrast badge -- solid fill, not styled text blending
   into the rest of the banner -- so BETA reads as an unmissable fact,
   not a footnote. */
.biz-banner-beta{display:inline-block;background:var(--gold);color:#1a1206;vertical-align:middle;margin-right:7px;
  font-family:var(--fm);font-size:11px;font-weight:900;letter-spacing:.08em;
  padding:3px 9px;border-radius:6px;margin-bottom:6px;}
.biz-banner-h{font-weight:800;font-size:14.5px;color:var(--text);line-height:1.35;margin-bottom:2px;}
.biz-banner-p{font-size:11.5px;color:var(--text2);line-height:1.45;}
.biz-banner-go{flex-shrink:0;color:var(--gold);font-weight:800;font-size:20px;align-self:center;}
@media(max-width:520px){ .biz-banner{border-radius:12px;padding:10px 13px;gap:10px;} .biz-banner-ico{font-size:22px;} .biz-banner-h{font-size:13.5px;} .biz-banner-p{font-size:11px;} }

.foot-asks{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin:4px 0 14px;}
.foot-ask{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:100px;
  font-family:var(--f);font-size:11.5px;font-weight:800;text-decoration:none;letter-spacing:.2px;
  transition:all .2s;white-space:nowrap;}
.foot-ask.store{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);color:var(--gold);}
.foot-ask.store:hover{background:var(--gold);color:#0a0e1a;}
.foot-ask.tip{background:transparent;border:1px solid var(--border2);color:var(--text2);}
.foot-ask.tip:hover{border-color:var(--gold);color:var(--gold);}
.foot-ask-note{font-family:var(--fm);font-size:10px;color:var(--text3);line-height:1.6;
  margin:-8px 0 14px;}
.foot-disc{margin-top:14px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);line-height:1.65;}
.foot-disc b{color:var(--text2);}
@media(max-width:768px){
  body{-webkit-overflow-scrolling:touch;}
  .hero-free{white-space:normal;text-align:center;line-height:1.7;font-size:11px;}
}

/* ===== TIGHTEN THE TOP, WIDEN THE MIDDLE ===== */

/* One line where it fits, and roughly two-thirds the size. It reads as
   a statement rather than a billboard, which suits an argument. */
.hero h1{font-size:clamp(22px,4.4vw,32px) !important;letter-spacing:-.6px !important;
  line-height:1.15 !important;margin-bottom:7px !important;}
.hero p{font-size:13.5px !important;max-width:44ch !important;line-height:1.5 !important;}
.hero-eyebrow{font-size:10px !important;margin-bottom:7px !important;letter-spacing:2.4px !important;}

/* Everything the headline gave up goes here. The capture slots are the
   point of the page and now look like it. */
.slot-body{max-width:150px !important;}
.slot-label{font-size:13.5px !important;font-weight:800 !important;}
.slot-hint{font-size:10px !important;}
.slot-tag{font-size:10.5px !important;}
.slot{padding:18px 14px !important;}

@media(max-width:520px){
  .slot-body{max-width:118px !important;}
  .hero h1{font-size:clamp(21px,6.2vw,26px) !important;}
}

/* The hero was taking a full screen before the scanner appeared. It
   still has to state the argument, but it does not need this much room
   to do it. */
.hero{padding-top:20px !important;padding-bottom:6px !important;}
.hero h1{font-size:clamp(26px,6vw,44px) !important;margin-bottom:8px !important;}
.hero p{font-size:14.5px !important;max-width:38ch !important;}
.hero-eyebrow{margin-bottom:9px !important;}
.hero-free{margin-top:11px !important;}

/* The capture boxes are the point of the page — give them the height
   the hero just gave up. */
.cap{min-height:172px !important;}
.cap-art{transform:scale(1.12);}

/* Seven rows becomes four, then two. The step text is short enough that
   a narrower column costs nothing. */
@media(min-width:720px){
  .flow{grid-template-columns:1fr 1fr;gap:12px;}
  .flow-step{padding:16px 18px;}
  .flow-q{font-size:15px;}
  .flow-a{font-size:12px;}
  .section-h{font-size:clamp(26px,4vw,36px) !important;margin-bottom:11px !important;}
  .section-sub{margin-bottom:22px !important;}
}

/* A way back to the scanner from anywhere down the page. */
.midcta{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;
  background:linear-gradient(135deg,rgba(34,197,94,.09),rgba(17,24,39,.4));
  border:1px solid rgba(34,197,94,.3);border-radius:var(--radius);
  padding:16px 20px;margin:26px 0 8px;text-align:center;}
.midcta-t{font-size:14px;font-weight:800;color:var(--text);line-height:1.4;}
.midcta-t span{color:var(--green);}
.midcta a{padding:11px 22px;border-radius:100px;background:var(--green);color:#052e16;
  font-family:var(--f);font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap;
  transition:all .2s;}
.midcta a:hover{background:#16a34a;transform:translateY(-1px);}

/* ===== THE SCANNER IS THE PAGE =====
   This one is the phone version — installed to a home screen and opened
   at a card table, usually one-handed, often in bad light. The capture
   slots are the only thing that matters here, so they get the room. The
   headline still earns its place (it is the argument for using this at
   all) but it does not need to be a billboard above a tool somebody
   opened deliberately. */
.hero h1{font-size:clamp(22px,5.4vw,34px);letter-spacing:-.6px;line-height:1.15;margin-bottom:8px;}
.hero p{font-size:14px;max-width:42ch;line-height:1.5;}
.hero{padding-top:22px;padding-bottom:12px;}

.slot-body{max-width:150px;}
.slot-label{font-size:13.5px;font-weight:800;}
.slot-hint{font-size:10px;}
.slot-tag{font-size:10.5px;}

/* A thumb reaching across a phone needs a bigger target than a mouse
   does, and the two slots are the only things on this screen worth
   hitting. */
@media(max-width:520px){
  .slot-body{max-width:126px;}
  .hero h1{font-size:clamp(21px,6.4vw,27px);}
  .hero p{font-size:13.5px;}
}

/* ===== ACCOUNTS AND SAVING =====
   A login button on a tool with no wall reads as a wall, so the free line
   sits beside it and the button says what it is actually for. */
.tb-right{display:flex;align-items:center;gap:8px;}
.tb-free{font-family:var(--fm);font-size:10px;letter-spacing:.06em;color:var(--green);white-space:nowrap;}
@media(max-width:560px){.tb-free{display:none;}}
.tb-auth{font-family:var(--f);font-size:11px;font-weight:700;letter-spacing:.5px;
  text-transform:uppercase;padding:6px 12px;border-radius:100px;border:1px solid var(--border2);
  background:var(--surface2);color:var(--text);cursor:pointer;white-space:nowrap;}
.tb-auth:hover{border-color:var(--green);color:var(--green);}
.tb-who{font-family:var(--fm);font-size:10px;color:var(--text2);white-space:nowrap;}
.tb-who b{color:var(--green);}
.tb-pro{font-family:var(--fm);font-size:9.5px;font-weight:700;letter-spacing:1px;padding:3px 8px;
  border-radius:100px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);
  color:var(--gold-warm);white-space:nowrap;}
.auth-modal{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9998;display:none;
  align-items:flex-start;justify-content:center;padding:60px 20px 20px;overflow-y:auto;}
.auth-modal.show{display:flex;}
.auth-inner{background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);
  padding:28px;max-width:380px;width:100%;position:relative;}
.auth-inner h3{font-family:var(--f);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--text);}
.auth-inner p{font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:18px;}
.auth-input{width:100%;padding:11px 14px;border-radius:8px;border:1px solid var(--border2);
  background:var(--surface2);color:var(--text);font-family:var(--f);font-size:13px;
  font-weight:600;outline:none;margin-bottom:10px;}
.auth-input:focus{border-color:var(--green);}
.auth-submit{width:100%;padding:12px;border-radius:8px;border:none;background:var(--green);
  color:#052e16;font-family:var(--f);font-size:13px;font-weight:800;cursor:pointer;margin-top:6px;}
.auth-switch{font-size:12px;color:var(--text3);text-align:center;margin-top:14px;}
.auth-switch a{color:var(--green);cursor:pointer;text-decoration:underline;font-weight:700;}
.auth-close{position:absolute;top:16px;right:18px;background:none;border:none;
  color:var(--text3);font-size:22px;cursor:pointer;line-height:1;}
.auth-err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;
  font-size:11.5px;font-weight:600;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:none;}
.auth-err.show{display:block;}
.save-row{display:flex;gap:9px;padding:14px 16px 10px;border-top:1px solid var(--border);
  background:rgba(34,197,94,.04);}
/* ===== NOT SIGNED IN =====
   The top bar says "Log in to save" and it is easy to miss — it is in
   the corner, above the fold, read once on arrival and forgotten by
   the time a result appears.

   This sits where saving actually happens, and it states the
   consequence rather than the status. "Log in to save" is a label;
   "this card will not be saved anywhere yet" is what somebody needs
   to know before they tap and assume it worked.

   It matters more here than on most sites because scan.cardgauge.com
   and cardgauge.com keep separate sessions. Somebody signed in on one
   arrives signed out on the other, with no reason to suspect it. */
.notin{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;
  background:rgba(245,158,11,.09);border-top:1px solid rgba(245,158,11,.32);
  font-size:12.5px;line-height:1.55;color:var(--gold-warm);}
.notin .ico{flex-shrink:0;font-size:14px;line-height:1.3;}
.notin b{color:#fff;}
.notin a{color:#fff;text-decoration:underline;cursor:pointer;font-weight:800;
  text-underline-offset:2px;}
.save-note{padding:0 16px 14px;background:rgba(34,197,94,.04);font-family:var(--fm);
  font-size:10.5px;line-height:1.6;color:var(--text3);text-align:center;}
.whats-next{padding:12px 16px 14px;background:rgba(34,197,94,.06);
  border-top:1px solid rgba(34,197,94,.14);font-family:var(--f);font-size:12.5px;
  font-weight:700;text-align:center;}
.whats-next a{color:var(--green);text-decoration:none;cursor:pointer;}
.whats-next a:hover{text-decoration:underline;}
.whats-next-sep{color:var(--text3);margin:0 10px;font-weight:400;}
.binder-link{display:block;text-align:center;padding:2px 16px 12px;font-family:var(--f);
  font-size:11.5px;font-weight:700;color:var(--text2);text-decoration:none;}
.binder-link:hover{color:var(--green);text-decoration:underline;}
/* ===== FOUR-PATH PANEL =====
   Compact by design: a 2x2 grid on a phone, four-across only once
   there's room. Keep and Watch look like the primary green action
   because they are one — Grade and Profit are quieter, since they're
   a detour to another tool, not the save itself. */
.next-actions{padding:14px 16px 4px;}
.na-label{font-family:var(--f);font-size:12px;font-weight:700;color:var(--text2);
  text-align:center;margin-bottom:10px;}
.na-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media(min-width:420px){.na-grid{grid-template-columns:repeat(4,1fr);}}
.na-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:11px 6px;
  border-radius:10px;border:1px solid var(--border2);background:var(--surface2);
  color:var(--text);font-family:var(--f);font-size:11px;font-weight:800;cursor:pointer;
  text-decoration:none;text-align:center;transition:all .16s;position:relative;}
.na-ic{font-size:18px;line-height:1;}
.na-sub{font-family:var(--fm);font-size:8.5px;font-weight:600;color:var(--text3);
  line-height:1.2;margin-top:-2px;}
.na-save-btn:disabled .na-sub{display:none;}
.na-save-btn{background:var(--green);color:#052e16;border-color:transparent;}
.na-save-btn:hover{background:#16a34a;}
.na-save-btn:disabled{opacity:.6;cursor:not-allowed;}
.na-btn:not(.na-save-btn):hover{border-color:var(--gold);color:var(--gold-warm);}
.na-pro{position:absolute;top:-6px;right:-4px;background:var(--gold);color:#3a2a06;
  font-family:var(--fm);font-size:8px;font-weight:800;letter-spacing:.04em;
  padding:1.5px 5px;border-radius:100px;}
.save-btn{flex:1;padding:12px;border-radius:10px;border:none;background:var(--green);
  color:#052e16;font-family:var(--f);font-size:13.5px;font-weight:800;cursor:pointer;transition:all .18s;}
.save-btn:hover{background:#16a34a;}
.save-btn:disabled{opacity:.6;cursor:not-allowed;}
.save-btn.ghost{background:var(--surface2);border:1px solid var(--border2);color:var(--text2);}
.save-btn.ghost:hover{border-color:var(--gold);color:var(--gold);background:var(--surface2);}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surface3);
  color:var(--text);padding:11px 22px;border-radius:8px;font-size:12px;font-weight:700;
  z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.5);border:1px solid var(--border2);}
</style>
<style>
/* TOOLS FIRST, EVERYTHING ELSE AFTER A LINE.

   The first version of this mirrored the Wix menu item for item --
   Features, Shop, More, Card value scanner, all of it. That was the
   wrong instinct. cardgauge.com is the marketing surface and the app is
   the tool surface; somebody inside the binder wants the other tools,
   not the shop.

   So: one way back, then the six tools, then the two pages worth
   stumbling into. Dollar Bin and Hot/Cold are dimmer and sit after a
   divider because they are a different kind of thing -- and because
   they have had roughly one session a month each. They are here on the
   chance that being reachable from where people actually are changes
   that, which is more than they have ever had.

   Everything else stays on cardgauge.com, one click away via the back
   link, and out of the way. */
.cgnav{display:flex;align-items:center;gap:0;overflow-x:auto;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;
  background:#0a0e1a;border-bottom:1px solid #1e2d45;padding:0 12px;}
.cgnav::-webkit-scrollbar{display:none}
.cgnav a{flex:0 0 auto;display:block;padding:11px 12px;text-decoration:none;
  font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:13.5px;
  font-weight:600;color:#cbd5e1;white-space:nowrap;
  border-bottom:2px solid transparent;}
.cgnav a:hover{color:#fff}
.cgnav a.on{color:#22c55e;border-bottom-color:#22c55e}
.cgnav a.home{color:#64748b;padding-left:0;font-weight:500}
.cgnav a.home:hover{color:#94a3b8}
.cgnav a.find{color:#7c8ba1;font-weight:500}
.cgnav a.find:hover{color:#cbd5e1}
.cgnav .bar{flex:0 0 auto;width:1px;height:16px;background:#1e2d45;margin:0 8px}
@media(max-width:640px){.cgnav a{font-size:12.5px;padding:10px 9px}}
</style>
<style>
/* A single pulse on the bench button after a wall-driven signup. Two
   seconds of attention on something that was already on the page, not
   a new interruption -- see the auth success handler. */
@keyframes cgBenchNudge{
  0%,100%{ transform:scale(1); box-shadow:0 0 0 0 rgba(34,197,94,0); }
  35%    { transform:scale(1.04); box-shadow:0 0 0 7px rgba(34,197,94,.22); }
}
.bench-btn-nudge{ animation:cgBenchNudge 1.3s ease-in-out 2; }
</style>

<!-- LINK PREVIEWS CAME FOR FREE ON WIX AND DID NOT SURVIVE THE MOVE.

     Wix injected Open Graph tags on every page, so a link pasted into
     Facebook, iMessage or a Discord showed a card with a title and a
     picture. Served as plain files these pages had none, and every link
     shared since the cutover has rendered as a bare grey URL -- the
     TikTok bio, the shop emails, a comment under a card-show post.

     Nothing was broken, which is why it went unnoticed: the page loads
     perfectly, it just looks like nothing worth tapping.

     og:image must be an absolute URL on a public host. Facebook fetches
     it from its own servers, so a relative path silently yields no
     image at all. -->
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="CardGauge"/>
<meta property="og:title" content="CardGauge — scan a card, see what it sold for"/>
<meta property="og:description" content="See what a card actually sold for — real completed sales, not asking prices. Scanning is free forever with a free account."/>
<meta property="og:url" content="https://app.cardgauge.com/scanner.html"/>
<meta property="og:image" content="https://app.cardgauge.com/og-image.png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="CardGauge — what it actually sold for, not what sellers are asking"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="CardGauge — scan a card, see what it sold for"/>
<meta name="twitter:description" content="See what a card actually sold for — real completed sales, not asking prices. Scanning is free forever with a free account."/>
<meta name="twitter:image" content="https://app.cardgauge.com/og-image.png"/>
</head>
<body>
<nav class="cgnav"><a class="home" href="https://www.cardgauge.com">&larr; cardgauge.com</a><span class="bar"></span><a class="on" href="/scanner.html">Scan</a><a href="/binder.html">Binder</a><a href="/profit-tracker.html">Tracker</a><a href="/portfolio.html">Portfolio</a><a href="/show-log.html">Show log</a><a href="/pre-grade.html">Pre-grade</a><span class="bar"></span><a class="find" href="/business.html" target="_top">For shops</a><a class="find" href="https://www.cardgauge.com/dollar-bin">Dollar Bin</a><a class="find" href="https://www.cardgauge.com/hotcold">Hot / Cold</a></nav>

<div class="topbar">
  <a href="https://www.cardgauge.com" target="_top" class="tb-brand">
    <div class="tb-logo">CARD<span>GAUGE</span></div>
    <div class="tb-badge">SCANNER</div>
  </a>
  <div class="tb-right" id="tbAuth">
    <span class="tb-free">Scanning is free</span>
    <!-- Must match what renderAuth() writes, or the old label flashes
         on load before the script runs. -->
    <button class="tb-auth" onclick="openAuth()">Track my collection</button>
  </div>
</div>

<div class="auth-modal" id="authModal">
  <div class="auth-inner">
    <button class="auth-close" onclick="closeAuth()">&times;</button>
    <!-- Matches the header button. Somebody who taps "Track my
         collection" should land on a panel saying the same thing back
         to them, not a different product name. -->
    <h3 id="authTitle">Track your collection</h3>
    <!-- Leads with what is already free, so this does not read as a
         paywall on a scanner that has none. Then the three things an
         account actually adds, in the order they matter: the cards
         survive, they follow you, and they get re-priced -- the last
         being the only one that is a reason to come back rather than
         insurance against loss. -->
    <p id="authSub">Scanning and pricing stay free. An account keeps your cards when this browser is cleared, opens the same collection on any device, and re-prices what you've saved every night. First 10 cards free, no password &mdash; just a code we'll email you.</p>
    <div class="auth-err" id="authErr"></div>

    <div id="authStepEmail">
      <input class="auth-input" id="authEmail" type="email" placeholder="your@email.com" autocomplete="email" onkeydown="if(event.key==='Enter')sendAuthCode()"/>
      <button class="auth-submit" id="authSubmit" onclick="sendAuthCode()">Email me a code</button>
    </div>

    <div id="authStepCode" style="display:none">
      <p style="font-size:12.5px;color:var(--text2);margin-bottom:12px;">
        Sent a code to <b id="authEmailShown" style="color:var(--text)"></b>. Enter it below.
      </p>
      <input class="auth-input" id="authCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8"
        placeholder="code from your email" autocomplete="one-time-code" onkeydown="if(event.key==='Enter')verifyAuthCode()"/>
      <button class="auth-submit" id="authVerifyBtn" onclick="verifyAuthCode()">Confirm code</button>
      <div class="auth-switch"><a onclick="backToEmailStep()">Use a different email</a>
        <span style="margin:0 6px">&middot;</span>
        <a onclick="sendAuthCode(true)">Resend code</a></div>
    </div>
  </div>
</div>

<!-- PSA BARCODE SCANNER -->
<div class="auth-modal" id="psaModal">
  <div class="auth-inner" style="max-width:340px;">
    <button class="auth-close" onclick="closePsaScanner()">&times;</button>
    <h3>Scan PSA barcode</h3>
    <p style="margin-bottom:14px;">Line up the barcode on the label. We'll pull the card, grade and cert straight from PSA.</p>
    <div id="psaReaderBox" style="border-radius:10px;overflow:hidden;background:#000;min-height:220px;position:relative;">
      <div id="psaReader" style="width:100%;"></div>
    </div>
    <div id="psaStatus" style="margin-top:12px;font-family:var(--fm);font-size:11.5px;color:var(--text3);text-align:center;">
      Point your camera at the barcode
    </div>
    <p style="margin-top:14px;font-size:11px;color:var(--text3);">
      Cert number printed under the barcode? <a onclick="switchToManualCert()" style="color:var(--gold-warm);cursor:pointer;text-decoration:underline;">Type it instead</a>
    </p>
    <div id="psaManualEntry" style="display:none;margin-top:10px;">
      <input id="psaManualCert" type="text" inputmode="numeric" placeholder="e.g. 84739201"
        style="width:100%;padding:11px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-size:13px;margin-bottom:8px;"
        onkeydown="if(event.key==='Enter')lookupPsaCert(document.getElementById('psaManualCert').value)"/>
      <button onclick="lookupPsaCert(document.getElementById('psaManualCert').value)"
        style="width:100%;padding:11px;border-radius:8px;border:none;background:var(--gold-warm);color:#1a1206;font-family:var(--f);font-weight:800;font-size:13px;cursor:pointer;">
        Look up cert
      </button>
    </div>
  </div>
</div>

<!-- REVIEW LISTING -->
<div class="auth-modal" id="reviewModal">
  <div class="auth-inner" style="max-width:380px;">
    <button class="auth-close" onclick="closeReviewListing()">&times;</button>
    <h3>Review your listing</h3>
    <p style="margin-bottom:16px;">Title and description are editable. Copy the description into eBay, or edit before you go.</p>

    <div style="font-family:var(--fm);font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Title</div>
    <input id="reviewTitle" type="text" style="width:100%;padding:13px 14px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-family:var(--f);font-weight:700;font-size:13px;margin-bottom:16px;"/>

    <div style="font-family:var(--fm);font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Description</div>
    <textarea id="reviewDesc" rows="4" style="width:100%;padding:13px 14px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:#cbd5e1;font-family:var(--f);font-size:12.5px;line-height:1.5;margin-bottom:16px;resize:vertical;"></textarea>

    <div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(160deg,rgba(34,197,94,.14),rgba(17,24,39,.5));border:1px solid rgba(34,197,94,.3);border-radius:12px;padding:14px 16px;margin-bottom:20px;">
      <span style="font-size:12.5px;color:var(--text2);">Suggested price</span>
      <span id="reviewPrice" style="font-family:var(--fbig);font-size:22px;color:var(--green);"></span>
    </div>

    <button onclick="submitListingToEbay()" style="width:100%;padding:14px;border-radius:10px;border:none;background:var(--gold-warm);color:#1a1206;font-family:var(--f);font-weight:800;font-size:14px;cursor:pointer;margin-bottom:6px;">
      List on eBay &rarr;
    </button>
    <div style="font-size:10px;color:var(--text3);text-align:center;margin-bottom:14px;">Opens eBay search &mdash; find a matching listing, then tap eBay's own "Sell one like this"</div>
    <button onclick="copyListingDescription()" id="copyDescBtn" style="width:100%;padding:13px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:var(--f);font-weight:700;font-size:13px;cursor:pointer;">
      Copy description
    </button>
  </div>
</div>

<div class="hero" id="top">
  <div class="hero-eyebrow">CardGauge</div>
  <!-- SCANNER FIRST, WORKSTATION SECOND.

       "The collector's workstation" is the right description of the
       whole product and the wrong first sentence for a stranger. It
       says what CardGauge IS rather than what they can DO, and a
       visitor arriving from a social link has about three seconds to
       decide whether this page is for them.

       227 of last week's 296 lookups were photo scans. The scanner is
       what people actually use, so the headline is the action, and the
       workstation idea moves to the line underneath where it still
       does its job -- explaining why the scan is worth keeping. -->
  <!-- "Know what it's worth" was vague where the product is specific.
       Worth is what somebody hopes for; sold is what somebody paid, and
       the gap between the two is the entire reason this exists.

       "See what it sold for" on its own was the stronger line but had
       nothing to refer to -- a stranger arriving cold reads it and asks
       "what did WHAT sell for?". Leading with "Scan a card" puts the
       card in the sentence in the first three words, then the promise
       lands. It keeps its punch as a social hook, where the caption
       supplies the context a cold page cannot. -->
  <h1>Scan a card. <span>See what it sold for.</span></h1>
  <!-- Was three sentences and ran to five lines on a phone, which
       pushed the capture slots off the first screen -- the exact thing
       the layout change was meant to stop. The workstation pitch is not
       what a stranger needs in the first three seconds, and it already
       has its own section further down. -->
  <p>Not what sellers are asking &mdash; what buyers actually paid.</p>

  <!-- ONE OBVIOUS THING TO DO.

       The headline said "Scan a card" and then offered no button that
       did it -- just two secondary links to other audiences, and the
       capture slots further down where a phone user has to scroll to
       find them. 92% of visitors never scan anything, and a page whose
       first tappable element points at card shops is part of that.

       This is the only primary action on the first screen. Everything
       else here is deliberately quieter. -->
  <div class="hero-cta-fine">Scanning is free forever &middot; Free account &middot; No scan limit</div>



</div>

<div class="wrap">
  <div class="scan-card" id="scanTop">
    <div class="dual">
      <label class="slot" id="slotFront" for="fileInput">
        <div class="slot-tag">Front</div>
        <div class="slot-body">
          <img class="slot-img" id="frontThumb" alt=""/>
          <div class="scanframe mini">
            <div class="fcard">
              <div class="holo"></div>
              <div class="serial">/99</div>
              <div class="bust"><i></i><b></b></div>
              <div class="plate"><u></u><s></s></div>
            </div>
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="scanline"></div>
          </div>
        </div>
        <div class="slot-label" id="frontLabel">Tap to add</div>
        <div class="slot-hint">required</div>
        <button class="slot-x" onclick="clearFront(event)" aria-label="Remove front">&times;</button>
      </label>

      <label class="slot back" id="slotBack" for="backInput">
        <!-- Was "Twice as accurate". That is a measured claim and
             nothing has been measured -- no defined baseline, no
             competitor, no test. It also invited exactly the question
             it could not answer: twice as accurate as what?

             "Front + back" is the actual differentiator and needs no
             number behind it. The badge still marks this slot as the
             one that matters; it just stops asserting something we
             cannot show. -->
        <div class="slot-badge">Front + back</div>
        <div class="slot-tag">Back</div>
        <div class="slot-body">
          <img class="slot-img" id="backThumb" alt=""/>
          <div class="scanframe mini">
            <div class="flip">&#8635;</div>
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
          </div>
        </div>
        <div class="slot-label" id="backLabel">Tap to add</div>
        <div class="slot-hint strong">year &amp; card number</div>
        <button class="slot-x" onclick="clearBack(event)" aria-label="Remove back">&times;</button>
      </label>
    </div>
    <input type="file" id="fileInput" accept="image/*"/>
    <input type="file" id="backInput" accept="image/*"/>
    <!-- The old line ran 33 words with a dash-clause in the middle, set
         in 11px monospace. Nobody read it. Same three facts, two short
         sentences. -->
    <div class="scan-intro"><b>The scanner.</b> Reads both sides, identifies the card, and looks
      for real sold prices. When the sales aren&rsquo;t clean enough to trust, it says so rather than
      pretending.</div>
    <div class="dual-note" id="dualNote"><b class="hot">Front only means we&rsquo;re guessing.</b><br/>The year, the card number and the set are printed on the <b>back</b> — the front is just artwork. Reading both sides is what makes the identification hold up.</div>
    <button class="scan-btn" id="scanBtn">🔍 Scan This Card</button>

    <div class="or-line">or type a card name</div>
    <div class="search-row">
      <input id="searchInput" placeholder="e.g. 2018 Topps Update Shohei Ohtani RC" onkeydown="if(event.key==='Enter')doSearch()"/>
      <button onclick="doSearch()">Search</button>
    </div>
    <div class="search-hint">✏️ Year + brand + player gets the best match</div>

    <!-- THE PSA ENTRY POINT IS GONE. THE CODE BEHIND IT IS NOT.

         It could not do the thing it advertised. PSA refuses the API at
         the account level -- "Access to this API is limited to approved
         customers" -- so a cert number can never return a card, a grade
         or a price. The best it managed was a link to psacard.com, which
         somebody holding a slab reaches on their own.

         The numbers, 30 days: psa_scanner_opened fired 30 times for 24
         people; two of them ever got a number to decode. So 22 of 24
         opened it, fought a barcode on curved reflective plastic, and
         left with nothing -- from the most prominent button on the
         capture screen.

         Removing the button, not the feature. openPsaScanner(),
         lookupPsaCert(), the modal and /api/psa-cert all remain. If PSA
         ever approves the account it works again by putting this button
         back -- one element, no rebuild.

         And a graded card is not stranded by this: the scanner reads
         slab labels itself. A PSA 8 Lightning Leaders Ohtani photographed
         on 9 Sept came back identified, at $76 off 20 sales, with nobody
         typing a cert number. The photo path was always the better one. -->

    <!-- For somebody who arrived from a video and has no card in their
         hand. Two empty photo boxes are useless to them; one tap on a
         card they recognise is not. -->
    <div class="tryrow">
      <div class="tryrow-k">No card to hand? Try one of these</div>
      <div class="trychips">
        <button class="trychip" onclick="trySample('2018 Topps Update Shohei Ohtani RC')">Ohtani rookie</button>
        <button class="trychip" onclick="trySample('1999 Pokemon Base Set Charizard 4/102')">Base Set Charizard</button>
        <button class="trychip" onclick="trySample('2003 Topps Chrome LeBron James')">LeBron rookie</button>
        <button class="trychip" onclick="trySample('2017 Topps Update Aaron Judge RC')">Judge rookie</button>
      </div>
    </div>

    <div class="status" id="status"></div>
  </div>

  <!-- MOVED BELOW THE SCANNER.

       These three were sitting between the headline and the capture
       slots -- a card-shop promo, a card-show tip and a share button,
       none of which the person who just arrived came to do. On a phone
       they pushed the one thing that matters off the first screen.

       The slots ARE the hero now. A visitor sees the headline and then
       two boxes asking for a photo, which is the whole product in one
       glance. Everything aimed at a different audience waits until
       after they have seen it. -->
  <!-- THE FEATURE NOBODY COULD FIND.

       The catalog subscription has been paid for since May and the set
       builder has had 2 lookups since it came back on 1 Sept. The
       feature works -- 1,251 cards across 86 sets are stored and the
       match rate is 56% -- it is simply buried where nothing links to
       it.

       Worth saying plainly that this is an announcement, not a
       permanent fixture. If it earns its place it stays; if the
       lookups do not move in two weeks the answer is that people do
       not want it here, and a louder banner will not change that. -->
  <a class="set-note" href="/binder.html" target="_top"
     onclick="logEvent('set_banner_click','standalone',false);if(window.ttq)ttq.track('ClickButton',{content_name:'set_banner',content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'set_banner',content_type:'scanner_standalone'})">
    <span class="set-note-tag">NEW</span>
    <span><b>Building a set?</b> We&rsquo;ll show you exactly which cards you&rsquo;re still missing.</span>
    <span class="set-note-go">&rarr;</span>
  </a>

  <a class="biz-note" href="/business.html" target="_top"

     onclick="logEvent('business_banner_click','scanner_page',false);if(window.ttq)ttq.track('ClickButton',{content_name:'business_banner_top',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'business_banner_top',content_type:'scanner_page'})">

    <!-- "BETA" IS THE WRONG WORD TO PUT IN FRONT OF A SHOP.

         A collector trying a beta scanner risks nothing. A shop
         putting its inventory in risks its data, and "beta" tells
         them it might break or lose things -- the precise opposite
         of what somebody needs to hear before trusting you with
         their stock.

         "FOR SHOPS" does more work anyway. It tells a collector to
         ignore this and a shop that it is theirs, which BETA never
         did for either.

         The free-ness has to survive the change: "free while in
         beta" explained WHY it costs nothing, and dropping the word
         without replacing the reason would read as a trick. "Free
         while we build it out" says the same thing without the
         warning label.

         Honest caveat: at 8 clicks in 30 days there is not enough
         evidence to blame the word. The position is the more likely
         culprit -- one small banner near the bottom of a page people
         came to for something else -- which is why this ships
         alongside a nav entry, and why business.html is being
         instrumented at the same time. Otherwise the next number
         moves and nobody knows which change moved it. -->
    <span class="biz-note-tag">FOR SHOPS</span>

    <span><b>Run a card shop or breaks?</b> Price a whole table in one photo &mdash; free while we build it out.</span>

    <span class="biz-note-go">&rarr;</span>

  </a>

  <!-- High on the page because it is a REASON to be here, not a

       footnote. Somebody heading to a show needs to know this before

       they leave the house, and the footer is read by nobody.



       Worded carefully. The scanner needs a connection and the card

       show log needs one for its first load — "no internet needed"

       would be false on both counts, and false in a way that only

       shows up when somebody is standing in a hall relying on it.

       What IS true: once the page is open, logging keeps working. -->

  <a class="show-tip" href="/show-log.html" target="_top"

     onclick="logEvent('showlog_banner_click','standalone',false);if(window.ttq)ttq.track('ClickButton',{content_name:'showlog_tip_top',content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'showlog_tip_top',content_type:'scanner_standalone'})">

    <span class="show-tip-ico">&#128246;</span>

    <span><b>At a show?</b> Log your finds in the card show log — open it before you go

    and it keeps working when the hall&rsquo;s wifi doesn&rsquo;t.</span>

    <span class="show-tip-go">&rarr;</span>

  </a>

  <div class="hero-free" style="max-width:640px;margin:14px auto 0">✓ <b>Scanning &amp; pricing:</b> free, unlimited with a free account &nbsp;·&nbsp; <b>Binder:</b> first 10 free &mdash; tracks sets, value &amp; profit too</div>
  <div style="text-align:center">
    <button class="share-link" onclick="shareCardGauge()">&#128257; Share CardGauge with a friend</button>
  </div>

  <div class="result" id="result"></div>

  <!-- The session bench. Renders from the second lookup on. -->
  <div id="benchBox"></div>
  <div id="localBinderBox"></div>

  <!-- What the scanner is a door to. See the CSS note above: pricing
       alone is no longer a reason to be here, so the reasons that ARE
       have to appear before somebody leaves. -->
  <div class="only">
    <div class="only-k">The rest of the bench</div>
    <div class="only-grid">

      <a class="only-item" href="/profit-tracker.html" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'only_tracker',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'only_tracker',content_type:'scanner_page'})">
        <span class="only-ico">&#128176;</span>
        <span class="only-body">
          <span class="only-t">What you'd actually clear, after fees</span>
          <span class="only-d">Not what it's worth &mdash; what lands in your pocket. Put in what
            you paid at a show and the fees you'll pay, and it works out
            <b>the number most tools quietly skip</b>.</span>
        </span>
      </a>

      <a class="only-item" href="/show-log.html" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'only_showlog',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'only_showlog',content_type:'scanner_page'})">
        <span class="only-ico">&#128246;</span>
        <span class="only-body">
          <span class="only-t">A show log that survives the hall wifi</span>
          <span class="only-d">Log finds at the table and see the damage at the end.
            <b>Open it before you go and it keeps working</b> when the signal doesn't.</span>
        </span>
      </a>

      <a class="only-item" href="/pre-grade.html" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'only_grade',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'only_grade',content_type:'scanner_page'})">
        <span class="only-ico">&#128269;</span>
        <span class="only-body">
          <span class="only-t">Whether it's worth grading &mdash; with the maths shown</span>
          <span class="only-d">Photographs the card, then puts that range against what each grade
            really sells for. <b>If it only pays at a 10, it says that's a bet, not a
            calculation.</b></span>
        </span>
      </a>

    </div>
    <div class="only-foot">Scanning and prices stay free. <b>The binder is free to 10 cards.</b>
      No marketplace, no commission &mdash; nothing here is priced to make a number look better.<br/>
      For raw sold comps alone, eBay's price guide and 130Point are both free and both good.</div>
  </div>

  <!-- ===== JUST FOR FUN — free tools nobody was pointed at =====
       Distinct from the "only" grid above on purpose: those are
       serious utility (fees, checklists, grading math). These four are
       browsing, not tasks — Dollar Bin, Hot/Cold, the stock comparison,
       the Pokemon zone. All four were already live and linked from
       nowhere on this page, which is a real waste: somebody who just
       got a price has no reason to leave, and these are exactly the
       kind of thing that turns "got my answer" into "let me look at
       one more thing" — the behaviour that makes a free account feel
       worth creating rather than a toll for one lookup. */ -->
  <div class="funblock" style="margin-top:18px;border:1px solid var(--border);border-radius:var(--radius-lg);
    background:linear-gradient(160deg,rgba(168,85,247,.07),rgba(17,24,39,.4));padding:22px 20px;">
    <div style="font-family:var(--fm);font-size:10px;letter-spacing:2px;text-transform:uppercase;
      color:#c084fc;margin-bottom:6px;">Just for fun &middot; also free</div>
    <div style="font-family:var(--fed);font-weight:700;font-size:19px;color:var(--text);
      letter-spacing:-.3px;margin-bottom:14px;">Nothing to track. Just poke around.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

      <a href="https://www.cardgauge.com/pokemon" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'fun_pokemon',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'fun_pokemon',content_type:'scanner_page'})"
         style="display:block;text-decoration:none;color:inherit;background:var(--surface);
           border:1px solid var(--border2);border-radius:12px;padding:14px;transition:all .2s;">
        <div style="font-size:22px;margin-bottom:6px;">&#9889;</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:3px;">Pokémon Zone</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.4;">What's hot in the sets everyone's chasing right now.</div>
      </a>

      <a href="https://www.cardgauge.com/hotcold" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'fun_hotcold',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'fun_hotcold',content_type:'scanner_page'})"
         style="display:block;text-decoration:none;color:inherit;background:var(--surface);
           border:1px solid var(--border2);border-radius:12px;padding:14px;transition:all .2s;">
        <div style="font-size:22px;margin-bottom:6px;">&#128293;</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:3px;">Hot / Cold Cards</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.4;">Which cards are climbing and which have gone quiet.</div>
      </a>

      <a href="https://www.cardgauge.com/cards-vs-stocks" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'fun_vsmarket',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'fun_vsmarket',content_type:'scanner_page'})"
         style="display:block;text-decoration:none;color:inherit;background:var(--surface);
           border:1px solid var(--border2);border-radius:12px;padding:14px;transition:all .2s;">
        <div style="font-size:22px;margin-bottom:6px;">&#128200;</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:3px;">Cards vs. Wall Street</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.4;">$100 in a card vs. $100 in Apple stock, tracked head to head.</div>
      </a>

      <a href="https://www.cardgauge.com/dollar-bin" target="_top"
         onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'fun_dollarbin',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'fun_dollarbin',content_type:'scanner_page'})"
         style="display:block;text-decoration:none;color:inherit;background:var(--surface);
           border:1px solid var(--border2);border-radius:12px;padding:14px;transition:all .2s;">
        <div style="font-size:22px;margin-bottom:6px;">&#128176;</div>
        <div style="font-size:13px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:3px;">Dollar Bin</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.4;">Real cards under $5 with actual upside, refreshed live.</div>
      </a>

    </div>
  </div>

  <div class="install" id="installCard"></div>

  <div class="cg-cta" id="ctaPanel" style="display:none"></div>
</div>



<!-- PASTE A LIST -->
<section style="padding:0 16px 6px;background:var(--bg);">
  <div class="wrap" style="max-width:560px;">
    <div style="display:flex;align-items:center;gap:12px;margin:6px 0 4px;">
      <div style="flex:1;height:1px;background:var(--border);"></div>
      <div style="font-family:var(--fm);font-size:10px;letter-spacing:.18em;color:var(--text3);
                  text-transform:uppercase;white-space:nowrap;">or you have more than one</div>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>

    <a href="/binder.html" target="_top"
       style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;
              background:linear-gradient(160deg,rgba(59,130,246,.10),rgba(17,24,39,.4));
              border:1px solid rgba(59,130,246,.32);border-radius:var(--radius);
              padding:16px 18px;margin-top:10px;transition:all .2s;"
       onclick="if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'paste_list_door\',content_type:\'scanner_page\'})">
      <div style="font-size:26px;flex-shrink:0;line-height:1;">&#128203;</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:3px;">
          Got a list already? Paste the whole thing.</div>
        <div style="font-size:12.5px;color:var(--text2);line-height:1.5;">
          Hundreds of cards at once, one per line &mdash; no scanning each one. Costs nothing,
          because nothing is looked up until you ask.
          <span style="color:var(--text3)">Needs a free account; first 10 cards free.</span></div>
      </div>
      <span style="color:var(--blue);font-weight:800;font-size:18px;flex-shrink:0;">&rarr;</span>
    </a>
  </div>
</section>

<!-- THE MARKETING PAGE CAME OFF THE SCANNER.

     How It Works, Run Your Collection, Protect Your Investment, Where
     This Fits and Why CardGauge Exists all lived below the scanner --
     about twelve screens of it. Every one was a second copy of a job
     cardgauge.com already does: the Wix site carries the blog, the
     About page, Dollar Bin, Hot/Cold, and nav into every tool.

     The person this page is for tapped an ad to price ONE CARD, often
     on cellular in a room with bad wifi. They were being handed the
     whole pitch below the fold whether they read it or not.

     What stays is what a scan actually needs: the scanner, the rest of
     the bench block right under it, the paste-a-list door to the
     binder, and the footer. Discovery is the nav bar, which links every
     tool from the top of the page, plus cardgauge.com -- which is the
     site that should be ranking for this content anyway.

     Nobody measured whether this was read. There is no scroll tracking,
     so this is a judgement, not a finding. It is one commit and the
     previous version is in the history. -->
<div class="foot">
  <div class="foot-row">
    <div class="foot-logo">CARD<span>GAUGE</span></div>
    <div class="foot-tag">The honest card market tool — like it used to be.</div>
    <div class="foot-links">
      <a href="#top" target="_top">Scanner</a>
      <a href="/pre-grade.html" target="_top">Grade Pre-Screen</a>
      <a href="/binder.html" target="_top">My Binder</a>
      <a href="/profit-tracker.html" target="_top">Profit Tracker</a>
      <a href="/show-log.html" target="_top">Card Show Log</a>
      <a href="https://www.cardgauge.com/shop" target="_top">Shop</a>
      <a href="https://www.cardgauge.com/blog" target="_top">Blog</a>
    </div>

    <!-- THE ONLY WAY TO FIND PRO IS NOW THE WALL.

         The $12.99 card came off with the rest of the marketing page,
         which was right -- it was the first thing under the scanner,
         price before product. But that left no way at all to discover
         Pro exists without first hitting an eleven-card binder, and
         pro_wall has fired zero times in thirty days.

         A line, not the card. Somebody who would happily pay can find
         out what it costs; nobody trying to price a card has to scroll
         past a pitch. Uses goPro() so it goes through the same Stripe
         path as the wall rather than a second link that can drift. -->
    <div class="foot-pro">
      <b>CardGauge Pro</b> &mdash; unlimited binder, profit tracker, portfolio.
      <a href="#" onclick="goPro(event);return false;">$12.99/mo &rarr;</a>
    </div>
    <a href="https://www.tiktok.com/@cardgauge" target="_blank" class="foot-tiktok" onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'tiktok_follow_footer',content_type:'home_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'tiktok_follow_footer',content_type:'home_page'})">🎬 Follow @cardgauge</a>
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSf5VC-6mTTr5MT5A_YxG2hqiRE4cVwX71H11jFoWDc6ekevxQ/viewform" target="_blank" rel="noopener" class="foot-bmac" onclick="if(window.ttq)ttq.track('ClickButton',{content_name:'feedback_footer',content_type:'home_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'feedback_footer',content_type:'home_page'})">💬 Give feedback</a>
    <div class="foot-fine">
      Sold prices are <b style="color:var(--text2)">real completed transactions</b> from the last 30 days,
      including accepted best offers. Asking prices show what is listed right now. Markets move —
      check current comps before buying, selling, or grading.<br>
      <b style="color:var(--green)">Scanning is free forever — a free account is what makes it unlimited.</b> That isn't a trial.<br><br>
      <b style="color:var(--text2)">CardGauge doesn't buy or sell cards.</b> No marketplace, no listing fees,
      no commission — so we have no reason to inflate a number. We do earn a small commission if you buy
      something through our eBay links. It costs you nothing and we don't set the prices.<br><br>
      <!-- THE PAGE THAT UPLOADS YOUR PHOTOGRAPH HAD NO PRIVACY LINK.

           Until now only business.html linked to the policy. The
           scanner sends a photo of your card to a third party for
           identification, asks for an email address, and sets two
           advertising pixels — and offered no way to read what happens
           to any of it.

           In the footer rather than the header on purpose: it should
           be findable, not prominent. Nobody wants a privacy notice
           competing with the scan button. -->
      <a href="https://www.cardgauge.com/privacy-policy" target="_blank" rel="noopener" style="color:var(--text2);text-decoration:none;">Privacy &amp; Terms</a><br>
      © 2026 CardGauge · Built in Florida<br>
      Built by <a href="https://www.switchbackwebco.com" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;font-weight:600;">Switchback Web Co</a> — websites for collectors, creators &amp; small businesses.<br>
      The scanner and sold prices stay free — affiliate clicks and CardGauge Pro keep the lights on.<br>
      Prices pulled live from eBay's public API. Educational tool — not financial advice. CardGauge may earn affiliate commissions at no cost to you.
    </div>
  </div>
</div>

<!-- AUTH MODAL -->







<script>
const API = 'https://stock-card-api.onrender.com';
const GRADE_MULTS = { '7':1.1, '7.5':1.25, '8':1.45, '8.5':2.0, '9':2.9, '9.5':4.2, '10':6.5 };

/* Which rungs the ladder shows depends on who graded the card.

   PSA has no half grades above 1, so its ladder is 7/8/9/10. CGC and BGS
   do, and in Pokemon a CGC 9.5 is the tier that actually trades — it was
   being silently discarded, because the old code only accepted whole
   numbers 7 through 10.

   The company also has to be read from the data rather than assumed. The
   old ladder was hardcoded "PSA" on every tile, so a card whose only real
   sales were CGC displayed CGC money under a PSA label. That is the same
   class of error as showing an asking price under a SOLD header. */
const GRADE_SCALES = {
  PSA: ['7', '8', '9', '10'],
  CGC: ['8', '9', '9.5', '10'],
  BGS: ['8', '9', '9.5', '10'],
  SGC: ['7', '8', '9', '10'],
  TAG: ['8', '9', '9.5', '10']
};

function parseGradeKey(key){
  var parts = String(key).trim().split(/\s+/);
  return { company: (parts[0] || '').toUpperCase(), value: parts[1] || '' };
}

/* The company with the most graded sales behind it wins the ladder.
   Mixing a PSA 9 and a CGC 9 into one rung would be averaging two
   different markets. */
function dominantCompany(bd){
  var tally = {};
  (bd || []).forEach(function(g){
    var p = parseGradeKey(g.grade);
    if(!p.company) return;
    tally[p.company] = (tally[p.company] || 0) + (g.count || 0);
  });
  var best = null, bestN = 0;
  Object.keys(tally).forEach(function(c){
    if(tally[c] > bestN && GRADE_SCALES[c]){ best = c; bestN = tally[c]; }
  });
  return best || 'PSA';
}
const GRADE_COST = 25;

/* Destination for the grade pre-screen CTA. VERIFY THIS PATH before deploy —
   if it 404s, the CTA is worse than not having one. */
const GRADE_TOOL_URL = '/pre-grade.html';

/* The PSA 10 has to be worth at least this many times the raw sale before we
   suggest grading. Below it, the honest answer is "don't bother." */
const GRADE_WORTH_IT_X = 2;

/* The sold-comps API returns at most this many records per query. When the
   count comes back exactly at the cap it is a ceiling, not a total, so it
   prints as "100+". If the plan's cap changes, change this one number. */
const SOLD_COUNT_CAP = 100;

/* A sold range this many times the median (in either direction) means the
   search is almost certainly matching more than one version of the card. */
const WIDE_SPREAD_X = 3;

/* Under this many sales/listings a refined search is noise, not precision. */
const THIN_RESULT_N = 3;

/* ===== EBAY PARTNER NETWORK ===== */
const EPN_CAMPID = '5339149252';
function ebayLink(query, soldOnly){
  var base = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query || '');
  if(soldOnly) base += '&LH_Sold=1&LH_Complete=1';
  base += '&mkevt=1&mkcid=1&mkrid=711-53200-19255-0&siteid=0&toolid=10001&campid=' + EPN_CAMPID;
  return base;
}
function tagEbay(url, soldOnly){
  if(!url) return '';
  if(url.indexOf('campid=') !== -1) return url;
  var joiner = url.indexOf('?') === -1 ? '?' : '&';
  return url + joiner + 'mkevt=1&mkcid=1&mkrid=711-53200-19255-0&siteid=0&toolid=10001&campid=' + EPN_CAMPID;
}

/* ===== SCAN COUNTER ===== */
const SB_URL='https://nlaqvfplecacbbdbmhxd.supabase.co';
const SB_KEY='sb_publishable_9e5zQmOwtT6aJM1t-xSEyQ_jA2tDY5N';
/* THE COMMENT HERE WAS WRONG FOR A MONTH.

   It said the tally "still increments so the running total keeps
   building". It does not. When the public pill came out, the call site
   went with it and this function was left with no callers -- so the
   figure froze at 2,820 and the private stats page kept printing it
   under the label "shown on the scanner", which was false twice over:
   not shown, and not current.

   Real all-time numbers on 13 Sept: 1,547 lookups, 1,253 scans. The
   frozen counter was nearly double both, on a dashboard whose whole
   job is to stop us reading numbers that do not mean what they say.

   The function is kept, unused, because the increment RPC still exists
   and a future pill would want it. It no longer claims to be running.
   The stats panel that displayed it has been removed. */
async function cgBumpCount(){
  try{
    var r=await fetch(SB_URL+'/rest/v1/rpc/increment_scan_counter',{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},body:'{}'});
    await r.json();
  }catch(e){}
}

var frontFile = null, scanning = false;
var lastResult = null;
/* Cards saved this session, so a re-render never shows a kept card as
   unkept. Keyed on display name, which is what the save writes. */
var savedKeys = {};      // last rendered payload (for re-price merges)
var nextActionShownFor = null;   // tracks the RESULT OBJECT, not the card name — see note below
var resultViewedFor    = null;   // same pattern, but for EVERY result — see renderResult()
var currentQuery = '';      // the search string behind the current numbers
var spreadFlagged = false;  // did this result trip the wide-spread warning
var refineBase = '';        // the query before any refinement chip was applied
var refineActive = null;    // {id,label,suffix} — at most one at a time
var refinePrev = null;      // the unrefined result, kept so Undo is instant

function fmtMoney(n){var v=Number(n||0);return v>0?'$'+Math.round(v).toLocaleString():'—';}
function safeNum(v){var n=Number(v||0);return isFinite(n)&&n>0?n:0;}
var JUNK_META=/^(unknown|n\/a|na|none|null|base|base set|common|-|\?)$/i;
function notJunk(v){var s=String(v==null?'':v).trim();return !!s && !JUNK_META.test(s);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/* drop eBay negative keywords (-lot, -reprint) from the display name */
function prettyName(q){return String(q||'').replace(/(^|\s)-\S+/g,'').replace(/\s+/g,' ').trim()||String(q||'');}
/* A scan runs two stages back to back on the server: identify the card
   from the photo, then price it. One frozen message for the whole wait
   both undersold what was happening and made the wait feel longer, so the
   text advances on a timer that mirrors the real sequence. */
var statusTimer = null;
function clearStatusStages(){
  if(statusTimer){ clearTimeout(statusTimer); statusTimer = null; }
}
function setStatusStages(stages){
  clearStatusStages();
  if(!stages.length) return;
  setStatus(stages[0].msg,'loading');
  var i = 1;
  (function next(){
    if(i >= stages.length) return;
    statusTimer = setTimeout(function(){
      var el = document.getElementById('status');
      // only advance if we're still mid-load
      if(el && el.className.indexOf('loading') > -1){
        setStatus(stages[i].msg,'loading');
        i++; next();
      }
    }, stages[i].after);
  })();
}

function setStatus(msg,type){
  if(!msg || type !== 'loading') clearStatusStages();var el=document.getElementById('status');if(!msg){el.className='status';el.innerHTML='';return;}el.className='status show '+(type||'');el.innerHTML=(type==='loading'?'<div class="spinner"></div>':'')+msg;}

/* "100" from a capped API is a ceiling, not a count. The backend now
   reports the limit it actually used (it halves it for refinements), so
   prefer that over the local default. */
/* One listener for every correction panel, now and any added later.
   Delegated because the panels are rebuilt on each result. */
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var tog = e.target.closest('.fixtog');
  if(tog){
    var fb = tog.closest('.fixbox');
    if(fb) fb.classList.toggle('open');
    return;
  }
  var cpl = e.target.closest('.cpl-h');
  if(cpl && cpl.parentNode && cpl.parentNode.classList){
    cpl.parentNode.classList.toggle('open');
    return;
  }
  var t = e.target.closest('.pcode-t');
  if(t && t.parentNode && t.parentNode.classList) t.parentNode.classList.toggle('open');
});

function soldCountLabel(n, cap){
  var v = Number(n||0);
  var c = Number(cap || SOLD_COUNT_CAP);
  return (v >= c) ? (c + '+') : String(v);
}

var fileInput=document.getElementById('fileInput');
var backInput=document.getElementById('backInput');

fileInput.addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0]; if(f) setFrontFile(f);
});
backInput.addEventListener('change',function(e){
  var f=e.target.files&&e.target.files[0];
  if(!f) return;
  // Before a scan: load it into the slot. After a result: rescan immediately.
  if(document.getElementById('backAsk')) rescanWithBack(f);
  else setBackFile(f);
});

/* Drag and drop onto either slot independently. */
function wireDrop(slotId, handler){
  var el=document.getElementById(slotId);
  if(!el) return;
  el.addEventListener('dragover',function(e){e.preventDefault();el.classList.add('drag');});
  el.addEventListener('dragleave',function(){el.classList.remove('drag');});
  el.addEventListener('drop',function(e){
    e.preventDefault(); el.classList.remove('drag');
    var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(f) handler(f);
  });
}
wireDrop('slotFront', function(f){ setFrontFile(f); });
wireDrop('slotBack',  function(f){ setBackFile(f);  });


/* SIX FAILED SCANS IN THIRTY-ONE MINUTES, ALL THE SAME ERROR.

   11 Sept, 05:10 to 05:41, one person trying over and over:

     "code": "invalid_image_format"
     "You uploaded an unsupported image. Please make sure your image
      has one of the following formats: ['png','jpeg','gif','webp']."

   That is HEIC. It is the iPhone default, and it arrives whenever
   somebody picks an existing photo from their library rather than
   taking a new one -- the camera path hands over JPEG, the library
   path often does not. accept="image/*" lets it through happily,
   nothing on the way to the server looks at the type, and OpenAI
   rejects it at the far end. The person got six generic failures and
   no idea why.

   Safari can DECODE HEIC natively -- it is Apple's own format -- so
   drawing it to a canvas and re-encoding as JPEG works on exactly the
   devices that produce it. No library, no server change, no upload of
   an unusable file.

   FAIL-SAFE BY CONSTRUCTION. This sits on the riskiest path in the
   app. Every failure mode -- decode error, canvas tainted, toBlob
   unsupported, anything at all -- returns the ORIGINAL file untouched,
   so the worst case is exactly what happens today rather than
   something new. It only ever improves the odds.

   ON RESOLUTION \u2014 TRIED CAPPING IT, IT MISREAD A YEAR, REVERTED.

   14 Sept: capped the long edge at 2200px on the theory that a
   copyright line would still land near 45 pixels and stay legible.
   That was arithmetic about an estimated print size, not a measurement.

   A 2024 Topps Heritage Pete Crow-Armstrong read correctly as 2024 at
   full resolution at 11:58, and came back as 2023 at 14:05 with the cap
   in place. Same card, one variable.

   It also bought nothing. Timing added the same day: vision 16,694ms
   against 1,457ms for active listings and 1,576ms for sold comps.
   Eighty-five percent of a scan is the model thinking, not the upload.
   Uploads were already down to ~1.4MB and the scan was still 12 seconds.

   So the trade was accuracy for no speed. The note below was right the
   first time. If resolution is ever revisited, it needs a measured
   print height and a batch of cards read before and after \u2014 not a
   calculation about a guess.

   THE ORIGINAL NOTE, WHICH STANDS:

   It said full resolution, on purpose, because the AI reads copyright
   lines and card numbers off these. That is the correct instinct: the
   year comes off the copyright line at the bottom of the back, in the
   smallest print on the card, and trading that away for a faster upload
   would sell the product's one real claim for bandwidth.

   But "full" was never the requirement. An iPhone 15 photo is about
   4284 x 5712. On a card back roughly 3.5 inches tall, a copyright line
   about 1/16 inch high lands near 90 pixels \u2014 far more than any OCR
   needs, and about four times the pixels being sent.

   Capped at 2200 on the long edge, that same line is still around 45
   pixels. Comfortably legible, and roughly a quarter of the bytes.

   Measured 14 Sept: /api/scan-card took 12.6s and 13.0s on two scans.
   Both the upload and the vision call scale with pixel count, so this
   is the one lever that touches both. It will not make the scan fast on
   its own.

   IF IDENTIFICATION GETS WORSE, RAISE THIS NUMBER FIRST. A wrong year
   costs more than three seconds. Scan the same card before and after
   and check the year and code still read correctly. */
var OK_IMAGE_TYPES = /^image\/(jpeg|jpg|png|gif|webp)$/i;

function toSupportedImage(f){
  return new Promise(function(resolve){
    try{
      if(!f) return resolve(f);
      /* An empty type is converted too. Some Android builds report ""
         for a perfectly good JPEG, and re-encoding one of those costs a
         moment; sending a HEIC with no type costs the whole scan. */
      if(OK_IMAGE_TYPES.test(f.type || '')) return resolve(f);

      var url = URL.createObjectURL(f);
      var img = new Image();
      var done = false;
      var finish = function(out){
        if(done) return; done = true;
        try{ URL.revokeObjectURL(url); }catch(e){}
        resolve(out || f);
      };
      /* If decoding hangs, do not hang with it. */
      setTimeout(function(){ finish(f); }, 8000);

      img.onload = function(){
        try{
          var c = document.createElement('canvas');
          c.width  = img.naturalWidth  || img.width;
          c.height = img.naturalHeight || img.height;
          if(!c.width || !c.height) return finish(f);
          c.getContext('2d').drawImage(img, 0, 0);
          if(!c.toBlob) return finish(f);
          c.toBlob(function(b){
            if(!b) return finish(f);
            try{
              var name = (f.name || 'card').replace(/\.[a-z0-9]+$/i, '') + '.jpg';
              finish(new File([b], name, { type:'image/jpeg' }));
            }catch(e){
              /* Older Safari has no File constructor; a Blob with a
                 name is what FormData actually needs. */
              try{ b.name = name; }catch(e2){}
              finish(b);
            }
          }, 'image/jpeg', 0.92);
        }catch(e){ finish(f); }
      };
      img.onerror = function(){ finish(f); };
      img.src = url;
    }catch(e){ resolve(f); }
  });
}
async function setFrontFile(f){
  /* Converted BEFORE it is stored, so whatever the scan button picks up
     is already something the far end accepts. See toSupportedImage. */
  f = await toSupportedImage(f);
  frontFile=f;
  clearBack();                                   // a new front means a new card
  var slot=document.getElementById('slotFront');
  var th=document.getElementById('frontThumb');
  if(th) th.src=URL.createObjectURL(f);
  if(slot) slot.classList.add('filled');
  var lbl=document.getElementById('frontLabel');
  if(lbl) lbl.innerHTML='&#10003; Front added';
  document.getElementById('scanBtn').style.display='flex';
  updateCapture();
}
function clearFront(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  frontFile=null;
  if(fileInput) fileInput.value='';
  var slot=document.getElementById('slotFront');
  if(slot) slot.classList.remove('filled');
  var lbl=document.getElementById('frontLabel');
  if(lbl) lbl.textContent='Tap to add';
  var btn=document.getElementById('scanBtn');
  if(btn) btn.style.display='none';
  updateCapture();
}
async function setBackFile(f){
  f = await toSupportedImage(f);   // see setFrontFile
  backFile=f;
  var slot=document.getElementById('slotBack');
  var th=document.getElementById('backThumb');
  if(th) th.src=URL.createObjectURL(f);
  if(slot) slot.classList.add('filled');
  var lbl=document.getElementById('backLabel');
  if(lbl) lbl.innerHTML='&#10003; Back added';
  updateCapture();
}
function clearBack(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  backFile=null;
  if(backInput) backInput.value='';
  var slot=document.getElementById('slotBack');
  if(slot) slot.classList.remove('filled');
  var lbl=document.getElementById('backLabel');
  if(lbl) lbl.textContent='Tap to add';
  updateCapture();
}

/* The button says exactly what it is about to send, and the note under the
   slots changes with it — so a front-only scan is always a choice, never
   something that happened by default. */
function updateCapture(){
  var btn=document.getElementById('scanBtn');
  if(btn){
    if(scanning){
      btn.textContent='\u23f3 Scanning\u2026';
    } else if(frontFile && backFile){
      btn.textContent='\ud83d\udd0d Scan both sides';
    } else if(frontFile){
      btn.textContent='\ud83d\udd0d Scan front only';
    }
  }
  var note=document.getElementById('dualNote');
  if(!note) return;
  if(frontFile && backFile){
    note.className='dual-note good';
    note.innerHTML='&#10003; Both sides &mdash; this is the accurate scan.';
  } else if(frontFile){
    note.className='dual-note';
    note.innerHTML='Front only works. <b>Adding the back is noticeably more accurate</b> '
      +'&mdash; the card number, set and year are printed there. It matters most on '
      +'vintage, Pok&eacute;mon and parallels.';
  } else {
    note.className='dual-note';
    note.innerHTML='The back has the card number, set and year printed on it. '
      +'Two sides reads that text instead of guessing from the picture.';
  }
}

/* Kept as an alias: older call sites and the rescan path still say updateScanBtn. */
function updateScanBtn(){ updateCapture(); }

document.getElementById('scanBtn').addEventListener('click',doScan);


/* ── ONE ID FOR BOTH SIDES OF THE SAME EVENT ────────────────────

   The pixel here and the Conversions API on the server both report a
   scan. Without a shared id Meta counts it twice on any device where
   the pixel is not blocked -- which flatters the numbers in exactly
   the direction that would make a bad ad look good.

   Meta collapses two events carrying the same event_id. The browser
   makes the id because only the browser knows the moment; it is sent
   with the scan request so the server can use the identical value.

   _fbp and _fbc are the cookies Meta's own pixel drops. They raise
   match quality substantially, and the server cannot read them --
   this is a cross-origin fetch, so no cookie travels with it. Read
   here and passed along explicitly. */
/* SEND A CORRECTION SO THE NEXT PERSON DOES NOT HAVE TO MAKE IT.

   Fire-and-forget on purpose. The correction has already been applied
   to this person's own result before this runs, so they are not
   waiting on the network and a failure costs them nothing at all --
   it costs one data point, which is the right thing to lose.

   The READ is sent, not the truth: what the model produced is the
   lookup key, because that is what the next person's scan will match
   on when the model makes the identical mistake. */
function reportCorrection(field, correctedTo){
  try{
    if(!lastResult || !correctedTo) return;
    fetch(API + '/api/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field: field,
        correctedTo: String(correctedTo),
        readYear:       lastResult.year || '',
        readBrand:      lastResult.brand || '',
        readSet:        lastResult.set || '',
        readCardNumber: lastResult.cardNumber || '',
        readPlayer:     lastResult.player || '',
        session: (typeof cgSession === 'function' ? cgSession() : '')
      })
    }).catch(function(){});
  }catch(e){}
}

/* ══════════════════════════════════════════════════════════════
   BUYMAX PANEL — inlined rather than loaded from /buymax-panel.js

   stock-card-api serves API routes only; it has no express.static and
   no public/ directory, so a <script src> pointing at it would 404.
   Adding static serving to an API service to deliver one file, then
   fetching that file cross-origin from scan.cardgauge.com, is more
   moving parts than pasting it here — and this file already holds
   every other line of the scanner's JavaScript inline with no build
   step.

   The trade is the same one the whole codebase carries: another copy
   to keep in sync. It belongs on the list with the two scanner files
   when the shared-logic extraction happens.
   ══════════════════════════════════════════════════════════════ */
/**
 * BUYMAX PANEL — scan result screen
 *
 * A "what should I pay?" panel that mounts under an existing scan result. It
 * holds no pricing logic of its own: it posts to /api/buymax and renders what
 * the engine returns. Change a threshold on the server and this follows.
 *
 * USAGE — inlined in this file rather than loaded by tag.
 *
 * (The original doc comment showed a script tag here. It has been
 *  removed, not reworded: an HTML parser closes a script block at the
 *  literal characters that end one, wherever they appear -- inside a
 *  string, inside a comment, it does not matter. Pasted in as-is, that
 *  one line ended this block 170 lines early, dumped the rest of the
 *  panel onto the page as text, and stopped the scanner taking
 *  photographs. Nothing in a syntax check catches it, because the
 *  JavaScript either side is perfectly valid.)
 *   <div id="buymax"></div>
 *
 *   BuyMaxPanel.mount('#buymax', {
 *     card: {
 *       name: cardTitle,          // whatever your scan result already holds
 *       card_number: cardNumber,
 *       set: setName,
 *       year: cardYear,
 *       player: playerName,
 *       parallel: chosenParallel, // null when the person picked "Base"
 *       condition: 'raw'
 *     },
 *     apiBase: '',                // same origin by default
 *     onEvent: (name, data) => logEvent(name, data)   // optional
 *   });
 *
 * Call mount() again after a re-price (parallel chooser, condition change) and
 * the panel resets itself.
 */
(function (global) {
  'use strict';

  var CSS = [
    '.bmx{font-family:inherit;border:1.5px solid #C3C6BB;border-radius:6px;padding:16px;margin:16px 0;background:#F7F8F4}',
    '.bmx h3{margin:0 0 4px;font-size:16px;font-weight:700;color:#16202B}',
    '.bmx .bmx-sub{margin:0 0 14px;font-size:13px;color:#5A6570;line-height:1.4}',
    '.bmx-ask{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
    '.bmx-ask label{font-size:14px;color:#16202B;white-space:nowrap}',
    '.bmx-ask .bmx-input{display:flex;align-items:center;border:1.5px solid #16202B;border-radius:4px;background:#fff;padding:0 10px;flex:1;max-width:150px}',
    '.bmx-ask .bmx-input span{color:#5A6570;font-size:16px}',
    '.bmx-ask input{border:0;outline:0;font:inherit;font-size:18px;font-weight:700;padding:9px 4px;width:100%;background:transparent;color:#16202B}',
    '.bmx-go{background:#16202B;color:#fff;border:0;border-radius:4px;padding:11px 16px;font:inherit;font-weight:700;font-size:15px;cursor:pointer}',
    '.bmx-go:disabled{opacity:.45;cursor:default}',
    '.bmx-go:focus-visible{outline:3px solid #B4791E;outline-offset:2px}',
    '.bmx-out{margin-top:16px;padding-top:14px;border-top:1.5px solid #C3C6BB}',
    '.bmx-verdict{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}',
    '.bmx-verdict b{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1}',
    '.bmx-verdict.buy b{color:#1F6F4A}.bmx-verdict.pass b{color:#A8322A}.bmx-verdict.review b{color:#B4791E;font-size:22px}',
    '.bmx-verdict em{font-style:normal;font-size:13px;color:#5A6570}',
    '.bmx-ladder{display:flex;gap:8px;margin:12px 0}',
    /* One rung when the opening offer and the ceiling round to the
       same figure -- see the ladder builder. flex:1 on a single
       child already fills the row, so this only needs to stop the
       gap reserving space for a rung that is not there. */
    '.bmx-ladder.one{gap:0}',
    '.bmx-profit{font-family:var(--fm);font-size:11.5px;color:#5B6150;margin:7px 0 0;text-align:center}',
    '.bmx-rung{flex:1;text-align:center;padding:10px 6px;border-radius:4px;background:#fff;border:1.5px solid #C3C6BB}',
    '.bmx-rung b{display:block;font-size:19px;font-weight:800;letter-spacing:-.02em;color:#16202B}',
    '.bmx-rung small{display:block;font-size:11px;color:#5A6570;margin-top:2px}',
    '.bmx-rung.t{border-color:#1F6F4A}.bmx-rung.t b{color:#1F6F4A}',
    '.bmx-rung.m{border-color:#A8322A}.bmx-rung.m b{color:#A8322A}',
    '.bmx-why{font-size:14.5px;line-height:1.55;color:#16202B;margin:12px 0 0}',
    '.bmx-meta{font-size:12.5px;color:#5A6570;margin:10px 0 0;line-height:1.45}',
    '.bmx-err{font-size:14px;color:#A8322A;margin:12px 0 0}',
    '.bmx-load{font-size:14px;color:#5A6570;margin:12px 0 0}'
  ].join('');

  function injectCss() {
    if (document.getElementById('bmx-css')) return;
    var el = document.createElement('style');
    el.id = 'bmx-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  var money = function (n) {
    return (n === null || n === undefined) ? '—' : '$' + Number(n).toFixed(2);
  };
  var money0 = function (n) {
    return (n === null || n === undefined) ? '—' : '$' + Math.round(Number(n));
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  function mount(target, opts) {
    injectCss();
    var root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return null;

    var apiBase = (opts && opts.apiBase) || '';
    var card = (opts && opts.card) || {};
    var emit = (opts && opts.onEvent) || function () {};

    root.innerHTML =
      '<div class="bmx">' +
        '<h3>What should I pay?</h3>' +
        '<p class="bmx-sub">Enter what the seller is asking. This works out the most you can pay and still make money after fees.</p>' +
        '<div class="bmx-ask">' +
          '<label for="bmx-price">Seller wants</label>' +
          '<div class="bmx-input"><span>$</span><input id="bmx-price" type="number" inputmode="decimal" min="0" step="1" placeholder="0"></div>' +
          '<button class="bmx-go" type="button" disabled>Check</button>' +
        '</div>' +
        '<div class="bmx-out" hidden></div>' +
      '</div>';

    var input = root.querySelector('#bmx-price');
    var button = root.querySelector('.bmx-go');
    var out = root.querySelector('.bmx-out');

    input.addEventListener('input', function () {
      button.disabled = !(Number(input.value) > 0);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !button.disabled) check();
    });
    button.addEventListener('click', check);

    function check() {
      var ask = Number(input.value);
      if (!(ask > 0)) return;

      button.disabled = true;
      out.hidden = false;
      out.innerHTML = '<p class="bmx-load">Working out what this is worth paying…</p>';
      emit('buymax_checked', { asking_price: ask, card: card.name });

      fetch(apiBase + '/api/buymax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'card', item: card, asking_price: ask })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          button.disabled = false;
          if (!d || d.success === false) {
            out.innerHTML = '<p class="bmx-err">' +
              esc((d && d.details && d.details[0]) || 'Could not work that out right now.') + '</p>';
            return;
          }
          render(d, ask);
          emit('buymax_result', {
            result: d.decision.result,
            asking_price: ask,
            maximum_buy_price: d.decision.maximum_buy_price,
            confidence: d.confidence.buymax_confidence
          });
        })
        .catch(function () {
          button.disabled = false;
          out.innerHTML = '<p class="bmx-err">Could not reach the pricing service. Try again in a moment.</p>';
        });
    }

    /* ── FLIP IT ────────────────────────────────────────────────

       The engine's answer was correct and unreadable. A real result:

         "At $35 you clear $26.82 after fees and costs. Not enough to
          call it either way -- this one needs your own judgement. Open
          at $29.82. Do not go above $33.89 -- past that the profit
          stops covering the risk. That ceiling is $5.13 lower than the
          profit target alone would set it -- withheld against the
          risks below, not a market price. The resale figure is the
          median of 20 completed sales..."

       Every clause true, and the thing somebody wants -- pay $35, keep
       $27 -- is in the middle of a paragraph that also holds the risk
       haircut, the rejection counts and three disclaimers.

       This orders it: the money first, the reason second, the working
       third, the caveats last and quiet. Same data, same verdict, same
       refusals. Nothing is hidden -- the full explanation is still
       here, below the numbers instead of around them.

       It also adds the case the old version could not express. On a $2
       card with $4 postage there is no purchase price that flips: the
       ceiling comes back at or below zero and quoting "$0.64" is
       technically true and practically nonsense. That now reads as
       what it is -- a bulk card, not a listing. */
    /* A LIVE INPUT ON AN ANSWER THAT CANNOT MOVE.

       When BuyMax produces no resale estimate, decide() returns REVIEW
       BEFORE it ever looks at the ask -- so $2, $50 and $400 all yield
       the identical paragraph. The engine is right to refuse; the panel
       was wrong to keep presenting a calculator, because a field with a
       Check button next to it promises that the number matters.

       Found by typing different amounts and watching nothing change.
       On a 1999 Base Set Charizard whose own page showed sales from
       $300 to $819, a $2 ask came back as "Your call -- not enough to
       call it either way". That reads as the engine weighing it up and
       shrugging. It never weighed anything: 50 of 50 listings were
       rejected and there was nothing to price against.

       The other flavour was worse, because the number DID move. With no
       sold value the loss was ask-minus-zero, so "At $5 you lose $5"
       and "At $10 you lose $10" -- responsive, and meaningless.

       no_call comes from buymax.js and marks exactly the REVIEWs where
       nothing was decided on. Here the panel says so and takes the
       input away, rather than inviting somebody to keep trying numbers
       against a fixed answer. A dead input makes an honest refusal look
       like a broken tool. */
    function renderNoCall(d) {
      var dec = d.decision || {};
      var mkt = d.market || {};
      var askRow = root.querySelector('.bmx-ask');
      if (askRow) askRow.hidden = true;

      out.innerHTML =
        '<div class="bmx-verdict review"><b>Can\u2019t price this one</b></div>'
        + '<p class="bmx-why">The sales found don\u2019t describe a single card, so there is no '
        + 'figure to work a ceiling back from. <b>Whatever you type would give the same answer</b>, '
        + 'which is why the box is gone rather than sitting there looking live.</p>'
        + '<p class="bmx-why">Narrow the search below \u2014 a card number, a grade or a parallel '
        + 'is usually enough \u2014 and this comes back.</p>'
        + (dec.reason ? '<p class="bmx-meta">' + esc(String(dec.reason)) + '</p>' : '')
        + (mkt.sold_comp_count
             ? '<p class="bmx-meta">' + esc(mkt.sold_comp_count + ' completed sales found, none of them usable for this card.') + '</p>'
             : '');
    }

    function render(d, ask) {
      var dec  = d.decision;

      /* Before anything else: an answer the ask played no part in. */
      if (dec && dec.no_call) { renderNoCall(d); return; }

      var lad  = d.price_ladder || {};
      var mkt  = d.market || {};
      var res  = Number(mkt.sold_market_value || 0);
      var ceil = (lad.maximum_buy_price === null || lad.maximum_buy_price === undefined)
                   ? null : Number(lad.maximum_buy_price);
      var prof = Number(dec.expected_profit || 0);

      /* NO CEILING AT ALL IS ITS OWN ANSWER. A card whose postage and
         fees exceed what it sells for cannot be flipped at any price,
         and saying "your ceiling is $0.64" invites somebody to try. */
      /* THE GUARD MISSED THE CASE IT WAS WRITTEN FOR.

         res is sold_market_value. When a card has no completed sales
         and the resale figure came from asking prices, res is 0 -- so
         `res > 0` skipped this branch on exactly the lookups that
         produce a nonsense ceiling.

         Seen 12 Sept on a Cam Skattebo: "$0 \u2014 pay no more than this",
         then "Open at $0.00. Do not go above $0.00", on a card the same
         page said sells for $7. The engine had nothing to work from and
         the panel dressed it up as a recommendation.

         askFallback catches that: a ceiling at or below 75 cents is not
         a price, whether the resale figure came from sales or from
         asks. The copy differs because the situations differ -- with
         sold data it is a fact about the card, with asks only it is a
         statement about the evidence. */
      var askFallback = (res <= 0 || res === null)
        && Number(mkt.active_median) > 0 && ceil !== null && ceil <= 0.75;

      if (askFallback) {
        out.innerHTML =
          '<div class="bmx-verdict review"><b>Nothing here to flip</b></div>'
          + '<p class="bmx-why">There are no completed sales for this card, and what sellers '
          + 'are asking \u2014 around ' + money0(mkt.active_median) + ' \u2014 does not cover postage '
          + 'and fees. <b>Whatever you type gives the same answer.</b></p>'
          + '<p class="bmx-why">Asking prices are a ceiling, not a value. Narrow the search '
          + 'below if this is the wrong card.</p>';
        var askRowF = root.querySelector('.bmx-ask');
        if (askRowF) askRowF.hidden = true;
        return;
      }

      if (res > 0 && ceil !== null && ceil <= 0.75) {
        out.innerHTML =
          '<div class="bmx-verdict pass"><b>Not one to flip</b>'
          + '<em>sells for ' + money0(res) + '</em></div>'
          + '<p class="bmx-why">Postage and fees come to more than the card is worth, so there '
          + 'is no price you could pay and still make anything. Fine in a lot, a repack or a '
          + 'show box &mdash; never as a single listing.</p>'
          + '<p class="bmx-meta">' + esc((mkt.sold_comp_count || 0) + ' completed sales, median '
          + money(res) + '.') + '</p>';
        return;
      }

      var word = dec.result === 'REVIEW' ? 'Your call'
               : (dec.result === 'BUY' ? 'Flip it' : 'Walk away');
      var cls  = dec.result.toLowerCase();

      var html = '<div class="bmx-verdict ' + cls + '"><b>' + word + '</b>'
               + '<em>at ' + money0(ask) + '</em></div>';

      /* THE SENTENCE, BEFORE THE TABLE. What it sells for and what is
         left after costs -- the two numbers a decision rests on, in the
         order somebody thinks about them. */
      if (res > 0) {
        html += '<p class="bmx-why"><b>Sells for ' + money0(res) + '.</b> '
              + (prof > 0
                  ? 'Pay ' + money0(ask) + ' and you keep about <b>' + money0(prof)
                    + '</b> once fees and postage come out.'
                  : 'At ' + money0(ask) + ' there is nothing left after fees and postage.')
              + '</p>';
      }

      /* TWO RUNGS AT MOST, AND ONLY WHEN THEY DIFFER.

         Three problems in three lines, all of them visible on a cheap
         card:

         The third rung was a PROFIT sitting in a row of prices. Read as
         a ladder it says "offer $5, never go above $5, then offer
         minus twelve dollars" -- and buymax.js says outright that
         walk_away_above is the same number as maximum_buy_price and
         must not be drawn as a third rung. The profit belongs in the
         sentence above, which already states it.

         money0 renders a negative as "$-296", which is not a currency
         format in any locale. moneySigned puts the sign outside.

         And the two remaining rungs collapse into each other on cheap
         cards, because the 12% opening band is under a dollar and both
         round to the same figure. "$5 / $5" is not a negotiating range;
         it is one number printed twice. When they round the same, say
         the one number once and say what it is. */
      if (ceil !== null) {
        var openAt   = lad.ask_below_target ? null : lad.target_offer;
        var sameRung = openAt === null
                    || money0(openAt) === money0(ceil);

        html += sameRung
          ? '<div class="bmx-ladder one">'
            + '<div class="bmx-rung m"><b>' + money0(ceil) + '</b>'
            + '<small>' + (lad.ask_below_target ? 'your ceiling &mdash; the ask is under it'
                                                : 'pay no more than this') + '</small></div>'
            + '</div>'
          : '<div class="bmx-ladder">'
            + '<div class="bmx-rung t"><b>' + money0(openAt) + '</b><small>open here</small></div>'
            + '<div class="bmx-rung m"><b>' + money0(ceil) + '</b><small>never above</small></div>'
            + '</div>';

        /* The profit, in prose, where a negative reads as a sentence
           rather than as a malformed price. */
        if (isFinite(prof)) {
          html += '<p class="bmx-profit">' + (prof > 0
                ? 'At ' + money0(ask) + ' you keep ' + money0(prof) + '.'
                : 'At ' + money0(ask) + ' you lose ' + money0(Math.abs(prof)) + '.')
                + '</p>';
        }
      }

      /* The engine's own words, kept in full and put after the numbers
         rather than in place of them. It carries the refusals and the
         risk reasons, and those must not be summarised away. */
      html += '<p class="bmx-why" style="opacity:.85">' + esc(d.explanation.detail) + '</p>';

      var meta = [];
      if (mkt.sold_market_value) {
        meta.push('Based on ' + mkt.sold_comp_count + ' completed sales, median ' + money(mkt.sold_market_value) + '.');
      }
      if (mkt.listings_used) {
        meta.push(mkt.listings_used + ' active listings checked, ' + mkt.listings_rejected + ' rejected as a different card.');
      }
      meta.push('Confidence ' + d.confidence.buymax_confidence + '/100 \u00b7 risk ' + d.risk.score + '/100.');
      (d.meta.assumptions || []).forEach(function (a) { meta.push(a); });
      html += '<p class="bmx-meta">' + meta.map(esc).join(' ') + '</p>';

      out.innerHTML = html;
    }

    return { check: check, el: root };
  }

  global.BuyMaxPanel = { mount: mount };
})(window);

function cgEventId(){
  return 'cg_' + Date.now().toString(36) + '_' +
         Math.random().toString(36).slice(2, 10);
}
function cgCookie(name){
  try{
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }catch(e){ return ''; }
}

async function doScan(){
  if(!frontFile||scanning)return;
  /* A CORRECTION BELONGS TO THE CARD IT WAS TYPED FOR.

     serialAsserted and yearAsserted were cleared only inside
     scanAnother() -- the "Scan another card" button. Anybody who
     simply retook the photos and pressed Scan kept the previous
     card's values, so the serial box would announce "Priced as /25"
     over a completely different card, and a typed year would silently
     rewrite the next card's query too.

     Reported from real use: the box always showed the last card's
     number. Reset here instead, at the one point every photo scan
     passes through, so it cannot depend on which button somebody
     happened to press. */
  serialAsserted = null;
  yearAsserted   = null;
  /* The gate. Before any work, before any cost -- an account ask that
     arrives after the spinner would waste an API call and read as a
     bait.

     WRAPPED, AND IT FAILS OPEN. If anything in this check throws --
     a storage exception, a helper that did not load, a future edit
     that references something undefined -- the scan must still run.
     A thrown error here would kill doScan before its first log line,
     so the symptom would be scanning silently stopping with NOTHING
     in the events to say why: no scan, no wall, no error. That is a
     day of lost scans and no way to see it from the data.

     Blocking a scan is the expensive failure. Missing a signup is
     the cheap one. */
  try{
    if(needsAccount()){ showAccountWall(); return; }
  }catch(e){
    try{ logEvent('account_gate_failed', String(e && e.message || e).slice(0,120), false); }catch(_){}
  }
  scanning=true;var btn=document.getElementById('scanBtn');btn.disabled=true;updateScanBtn();
  setStatusStages([
    { msg:'Reading the card\u2026', after:0 },
    { msg:'Finding real sold prices\u2026', after:2600 },
    { msg:'Checking what sellers are asking\u2026', after:6000 }
  ]);
  /* One id, used by the pixel here AND by the server's Conversions API
     call, so Meta collapses the pair instead of counting the scan
     twice on any device where the pixel is not blocked. */
  var cgEid = cgEventId();
  if(window.ttq)ttq.track('Search',{content_type:'card_scan',content_name:'standalone_scan'});
  if(window.fbq)fbq('track','Search',{content_type:'card_scan',content_name:'standalone_scan'},{eventID:cgEid});
  try{
    var fd=new FormData();fd.append('front',frontFile);
    if(backFile)fd.append('back',backFile);
    /* Sent with the scan so the server reports the same event. The two
       Meta cookies go too -- the server cannot read them, because this
       is a cross-origin fetch and no cookie travels with it. */
    fd.append('eventId', cgEid);
    var _fbp = cgCookie('_fbp'); if(_fbp) fd.append('fbp', _fbp);
    var _fbc = cgCookie('_fbc'); if(_fbc) fd.append('fbc', _fbc);
    if(cgIsOwner()) fd.append('fresh','1');
    var r=await fetch(API+'/api/scan-card',{method:'POST',body:fd});
    if(!r.ok)throw new Error('Server error '+r.status);
    var d=await r.json();
    if(!d.success)throw new Error(d.error||'Scan failed');
    noteFreeScan();   /* only a scan that returned a card counts */
    if(!currentUser) bumpAnonScanCount();
    renderResult(d);setStatus('','');
    cgBumpCount();
    logEvent('scan', d.cardName, !!backFile);
    /* Confidence tracking — added after a real case surfaced only by
       luck. Now queryable directly: how often is the model itself
       flagging uncertainty, and on which cards. */
    if(d.confidence === 'Low'){
      logEvent('scan_confidence_low', d.cardName, !!backFile);
    }
    if(!currentUser){
      var anonN = 0;
      try{ anonN = parseInt(sessionStorage.getItem(ANON_SCAN_KEY) || '0', 10) || 0; }catch(e){}
      var bucket = anonN <= 3 ? String(anonN) : '4plus';
      logEvent('anonymous_scan_' + bucket, null, false);
    }
    if(window.ttq)ttq.track('ViewContent',{content_name:d.cardName,content_type:'scan_result'});if(window.fbq)fbq('track','ViewContent',{content_name:d.cardName,content_type:'scan_result'});
  }catch(e){setStatus('❌ '+e.message,'error');}
  scanning=false;btn.disabled=false;updateScanBtn();
}

/* Fills the box and runs it for real. Deliberately not a stored result
   \u2014 somebody tapping this is deciding whether to trust the numbers,
   and a canned answer is exactly the wrong thing to show them. */
function trySample(q){
  var el = document.getElementById('searchInput');
  if(!el) return;
  el.value = q;
  if(window.ttq) ttq.track('Search',{content_name:q,content_type:'sample_card'});if(window.fbq)fbq('track','Search',{content_name:q,content_type:'sample_card'});
  doSearch(true);
}

/* isSample distinguishes a genuine typed search from a tap on one of the
   "try one of these" chips. Four sample chips tapped by a fraction of
   every session were drowning out real query diversity in "Most looked
   up," so the event name is what lets the stats query tell them apart
   without changing anything the user sees. */
async function doSearch(isSample){
  /* Same reasoning as doScan. A typed search is a new card too, and a
     serial left over from a scan would be asserted over it. */
  serialAsserted = null;
  yearAsserted   = null;
  var q=(document.getElementById('searchInput').value||'').trim();
  if(!q){setStatus('Enter a card name first','error');return;}

  /* OWNER SWITCH, TYPED RATHER THAN IN THE URL.

     ?owner=1 works on the standalone PWA because that is a top-level
     page. It CANNOT work on the Wix scanner: that runs inside an HTML
     component iframe, so the query string lands on the parent page and
     location.search inside the frame is empty. There was no way to set
     the flag on the surface carrying most of the traffic.

     Typing it into the search box works on every surface, iframe or
     not. It is not a secret -- it sits in readable frontend JavaScript,
     like every other client-side flag here -- and it does not need to
     be: it skips a funnel prompt and keeps test scans out of the
     numbers. Anybody who wanted three more scans can already clear
     localStorage. */
  var qc = q.toLowerCase().replace(/\s+/g,'');
  if(qc === 'cgowner' || qc === 'cgownerof'){
    try{ localStorage.setItem(CG_OWNER_KEY,'1'); }catch(e){}
    document.getElementById('searchInput').value='';
    setStatus('Owner mode on \u2014 no scan wall, and your scans stay out of the numbers','ok');
    return;
  }
  if(qc === 'cgownerofff' || qc === 'cgvisitor'){
    try{ localStorage.removeItem(CG_OWNER_KEY); }catch(e){}
    document.getElementById('searchInput').value='';
    setStatus('Owner mode off \u2014 you will see the site as a visitor does','ok');
    return;
  }
  setStatusStages([
    { msg:'Finding real sold prices\u2026', after:0 },
    { msg:'Checking what sellers are asking\u2026', after:3200 }
  ]);
  if(window.ttq)ttq.track('Search',{content_name:q,content_type:'standalone_search'});if(window.fbq)fbq('track','Search',{content_name:q,content_type:'standalone_search'});
  try{
    /* Owner mode skips the comp cache so a filter change can be seen
       immediately. See getSoldComps in server.js -- it still writes,
       so the next visitor gets the fresh answer. */
    var r=await fetch(API+'/api/card-market?query='+encodeURIComponent(q)
          + (cgIsOwner() ? '&fresh=1' : ''));
    if(!r.ok)throw new Error('Server error '+r.status);
    var d=await r.json();
    if(!d.success)throw new Error(d.error||'Search failed');
    d.cardName=d.cardName||q;
    d.searchQuery=d.searchQuery||q;
    renderResult(d);setStatus('','');
    cgBumpCount();
    logEvent(isSample ? 'search_sample' : 'search', d.cardName, false);
  }catch(e){setStatus('❌ '+e.message,'error');}
}

/* ===== PSA BARCODE SCANNER =====
   PSA already knows exactly what's in the holder — player, year, set,
   card number, grade. Skip AI identification entirely and go straight
   from cert number to pricing, the same pipeline /api/scan-card uses,
   just fed PSA's own ground truth instead of a photo guess.

   Uses html5-qrcode (ZXing-based under the hood) rather than the
   native BarcodeDetector API — BarcodeDetector isn't available on iOS
   Safari, which is a large share of this site's mobile traffic. */
var psaScanner = null;
var psaLookupInFlight = false;

function openPsaScanner(){
  logEvent('psa_scanner_opened', null, false);
  var m = document.getElementById('psaModal');
  if(m) m.classList.add('show');

  /* MANUAL ENTRY IS NOT A FALLBACK, IT IS THE PATH MOST PEOPLE NEED.

     Measured: psa_scanner_opened fired 30 times for 24 people, and
     psa_unavailable -- which only fires AFTER a barcode decodes --
     fired twice. So 22 of 24 opened the scanner and never got a number
     out of it. Their cameras worked; the barcode would not read.

     It was hidden unless Html5Qrcode failed to load entirely, which is
     the one failure that almost never happens. The common failure --
     a small scan box, a curved slab, a reflective label -- left people
     staring at a viewfinder with no way forward.

     Shown from the start now. The camera still runs and still wins
     when it works; typing four digits is not a punishment. */
  var man = document.getElementById('psaManualEntry');
  if(man) man.style.display = '';
  setPsaStatus('Point your camera at the barcode \u2014 or type the cert number below', false);

  if(typeof Html5Qrcode === 'undefined'){
    setPsaStatus('Camera scanning isn\u2019t available right now \u2014 type the cert number below instead.', true);
    switchToManualCert();
    return;
  }

  try{
    psaScanner = new Html5Qrcode('psaReader');
    psaScanner.start(
      /* REVERTED TO THE ORIGINAL ON 5 SEPT, DELIBERATELY.

         Two changes were tried here to improve decoding of a dense PSA
         Code 128: a resolution request and the native BarcodeDetector.
         The first was put in the camera-identifier argument, which
         accepts only facingMode or deviceId, so start() threw and the
         modal showed a black rectangle. Moving it to videoConstraints
         did not bring the camera back either.

         The camera worked before any of it. Decoding was marginal, and
         the endpoint behind it returns 403 regardless, so none of this
         could have completed a lookup even if it had worked. Trading a
         working camera for a better decoder in front of a broken API
         was the wrong trade; this is the config that ran. */
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 80 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13
        ] },
      function(decodedText){ onPsaBarcodeDecoded(decodedText); },
      function(){ /* per-frame no-match — expected constantly while scanning, not an error */ }
    ).catch(function(err){
      setPsaStatus('Couldn\u2019t open the camera \u2014 check camera permissions, or type the cert number below.', true);
      switchToManualCert();
    });
  }catch(e){
    setPsaStatus('Camera scanning isn\u2019t available \u2014 type the cert number below instead.', true);
    switchToManualCert();
  }
}

function closePsaScanner(){
  var m = document.getElementById('psaModal');
  if(m) m.classList.remove('show');
  if(psaScanner){
    try{ psaScanner.stop().then(function(){ psaScanner.clear(); }).catch(function(){}); }catch(e){}
    psaScanner = null;
  }
}

function switchToManualCert(){
  document.getElementById('psaManualEntry').style.display = '';
  var f = document.getElementById('psaManualCert');
  if(f) f.focus();
}

function setPsaStatus(msg, isWarn){
  var el = document.getElementById('psaStatus');
  if(!el) return;
  el.textContent = msg;
  el.style.color = isWarn ? 'var(--gold-warm)' : 'var(--text3)';
}

function onPsaBarcodeDecoded(decodedText){
  var digits = String(decodedText || '').replace(/[^0-9]/g, '');
  if(digits.length < 6){
    setPsaStatus('That doesn\u2019t look like a PSA cert \u2014 try again or type it below.', true);
    return;
  }
  lookupPsaCert(digits);
}

async function lookupPsaCert(certNumber){
  var clean = String(certNumber || '').replace(/[^0-9]/g, '');
  if(!clean){ setPsaStatus('Enter a cert number first.', true); return; }
  if(psaLookupInFlight) return;
  psaLookupInFlight = true;

  setPsaStatus('Looking up cert ' + clean + '\u2026', false);
  setStatusStages([{ msg:'Looking up PSA cert ' + clean + '\u2026', after:0 }]);

  try{
    var r = await fetch(API + '/api/psa-cert?cert=' + encodeURIComponent(clean));
    var d = await r.json();
    if(!d.success){
      /* A SERVICE THAT IS NOT ANSWERING IS NOT THE PERSON'S MISTAKE.

         Every failure here used to render as a red cross, including
         PSA refusing us at the account level -- which reads as "your
         cert number is wrong" when the cert was perfectly good. They
         then retype it, get the same cross, and conclude the scanner
         is broken.

         The server now says which kind of failure it was. An
         unavailable one gets a warning rather than an error, keeps the
         typed number on screen, and points at the path that still
         works: the label has everything needed to type the card in. */
      /* THE ANSWER WAS BEING WRITTEN WHERE NOBODY COULD SEE IT.

         This function sets TWO status messages: setPsaStatus(), which
         writes into #psaStatus inside the modal, and setStatusStages(),
         which drives the main page's blue spinner banner.

         The success path clears the banner -- closePsaScanner(),
         renderResult(), setStatus('',''). Every failure path did not. So
         a refused lookup wrote its explanation into the modal and left
         the page saying 'Looking up PSA cert 141568891...' with a
         spinner, indefinitely.

         Confirmed against a real attempt on 9 Sept: the request
         completed server-side in 721ms with PSA's 403, and the screen
         still showed the spinner. If the modal had closed by then, the
         entire answer went into a hidden element. From outside it looks
         exactly like typing a cert number does nothing at all -- which
         is what it was reported as.

         Cleared first, before anything else is decided, so no branch
         below can forget to. And when the modal is not on screen the
         message is put on the page instead, because a message in a
         hidden container is the same as no message. */
      setStatus('','');
      var psaModalEl = document.getElementById('psaModal');
      var psaModalOpen = !!(psaModalEl && psaModalEl.classList.contains('show'));

      if(!psaModalOpen){
        setStatus((d.error || 'PSA could not be reached for that cert.')
          + ' Photograph the slab instead \u2014 the scanner reads the label.', 'warn');
        psaLookupInFlight = false;
        return;
      }

      if(d.unavailable){
        /* PSA'S OWN PAGE NEEDS NO API AND NO APPROVAL.

           The API is refused at the account level -- "Access to this
           API is limited to approved customers" -- and that is theirs
           to grant, not ours to fix. But psacard.com/cert/<number> is
           a plain public page, and the barcode reader has already done
           the hard part by reading the number off the label.

           So the scan still does something useful: it takes the person
           straight to PSA's record for the slab in their hand. Not the
           price -- that still comes from typing the card in -- but the
           verification half, which is what a cert number is for.

           Left as a link rather than opened automatically. A scanner
           that silently throws you onto another website is startling,
           and somebody may only have wanted to check the number. */
        logEvent('psa_unavailable', String(clean).slice(0,20), false);
        var psaUrl = 'https://www.psacard.com/cert/' + encodeURIComponent(clean);
        var box = document.getElementById('psaStatus');
        if(box){
          /* No className here: the element is styled inline and there
             is no .psa-status rule in this file. Setting one would look
             deliberate and do nothing. */
          box.style.color = 'var(--gold-warm, #fbbf24)';
          box.innerHTML =
              /* PSA discontinued public API access on 8 Sept and now
                 sell an enterprise tier at $2,500 a year. "Waiting on
                 access" was true when it was written and is not any
                 more, and a message that describes a feature as
                 pending when it is not reads as neglect.

                 It also overstated what is missing. The cert lookup
                 works: the barcode gives the number and PSA's own page
                 gives the record, which is more authoritative than
                 anything an API would hand back. What is absent is
                 auto-filling the fields, which is a convenience. */
              '<div style="line-height:1.6">Cert <b>' + esc(clean) + '</b> read. '
            + 'PSA holds the record for this slab \u2014 open it below.</div>'
            + '<a href="' + psaUrl + '" target="_blank" rel="noopener" '
            + 'onclick="logEvent(\'psa_link_opened\',\'' + clean + '\',false)" '
            + 'style="display:inline-block;margin-top:10px;padding:10px 16px;border-radius:10px;'
            + 'background:var(--green,#22c55e);color:#052e16;font-weight:800;font-size:13px;'
            + 'text-decoration:none">Check cert ' + esc(clean) + ' on PSA \u2192</a>'
            /* THE PRICE PATH IS A PHOTO, NOT A FORM.

               This asked for four fields typed by hand off the label.
               The scanner reads graded slabs already -- the AI prompt
               instructs it to, and a PSA 8 Ohtani scanned on 9 Sept
               returned the right card and $76 from 20 sales without
               anybody typing anything.

               Somebody holding a slab in front of a camera should be
               told to take the photo, not to read the label out loud
               into a form. A button rather than a sentence, because
               the sentence was the instruction and it still left them
               to find their own way back. */
            + '<div style="margin-top:12px;font-size:12px;color:var(--text3,#94a3b8);line-height:1.6">'
            + 'For the price, just photograph the slab \u2014 the scanner reads the label.</div>'
            + '<button type="button" onclick="closePsaScanner()" '
            + 'style="display:inline-block;margin-top:8px;padding:10px 16px;border-radius:10px;'
            + 'background:transparent;color:var(--green,#22c55e);border:1px solid var(--green,#22c55e);'
            + 'font-weight:800;font-size:13px;cursor:pointer">\ud83d\udcf7 Scan the slab instead</button>';
        } else {
          setPsaStatus('\u26a0\ufe0f ' + (d.error || 'PSA lookup is unavailable right now.'), true);
        }
        psaLookupInFlight = false;
        return;
      }
      throw new Error(d.error || 'Could not find that cert');
    }

    closePsaScanner();
    renderResult(d);
    setStatus('','');
    cgBumpCount();
    logEvent('psa_cert_lookup', d.cardName, false);
    if(window.ttq) ttq.track('Search',{content_name:d.cardName,content_type:'psa_cert_scan'});if(window.fbq)fbq('track','Search',{content_name:d.cardName,content_type:'psa_cert_scan'});
  }catch(e){
    /* Same clearing rule as the refusal path above. A thrown error left
       the spinner running too, and a network failure is the case where
       somebody is most likely to be staring at it. */
    setStatus('','');
    var mEl = document.getElementById('psaModal');
    if(mEl && mEl.classList.contains('show')){
      setPsaStatus('\u274c ' + e.message, true);
    }else{
      setStatus('Could not look that cert up: ' + e.message, 'warn');
    }
  }
  psaLookupInFlight = false;
}

/* ===== ADD THE BACK OF THE CARD =====
   Offered AFTER the result, and only when a PHOTO scan looks shaky: low
   confidence, an unknown card number, a parallel it couldn't name, or too
   few listings to trust.

   The frontFile guard matters. A typed search has no front image at all,
   so d.cardNumber is always empty and the old code offered to "read the
   back" for a card the user never photographed — and the rescan it
   promised was impossible, since rescanWithBack needs a front. */
var backFile = null, backPending = false;

function needsBack(d){
  if(!frontFile) return false;              // typed search — there is no front
  if(!d || d.corrected) return false;
  if(backFile) return false;
  var conf = String(d.confidence||'').toLowerCase();
  if(conf.indexOf('low') === 0) return true;
  var unknown = function(v){ return !v || /^(unknown|n\/a|none|-)$/i.test(String(v)); };
  if(unknown(d.cardNumber)) return true;
  if(unknown(d.year) || unknown(d.set)) return true;
  if(d.matchQuality === 'thin' || d.matchQuality === 'base_fallback' ||
     d.matchQuality === 'loose' || d.matchQuality === 'none') return true;
  if((d.listingCount||0) < 3) return true;
  return false;
}

function backReason(d){
  var conf = String(d.confidence||'').toLowerCase();
  if(conf.indexOf('low') === 0) return 'The front photo was hard to read.';
  var unknown = function(v){ return !v || /^(unknown|n\/a|none|-)$/i.test(String(v)); };
  if(unknown(d.cardNumber)) return 'We could not read the card number off the front.';
  if(unknown(d.year) || unknown(d.set)) return 'We could not pin down the year or set from the front.';
  if(d.matchQuality === 'base_fallback') return 'We could not find listings for this exact version.';
  if(d.matchQuality === 'thin' || (d.listingCount||0) < 3) return 'Only a few listings matched.';
  return 'The front alone left some doubt.';
}

function buildBackAsk(d){
  if(!needsBack(d)) return '';
  return '<div class="backask" id="backAsk">'
    +'<div class="backask-q">Add the back of the card?</div>'
    +'<div class="backask-sub">'+esc(backReason(d))
      +' The back has the card number, set and year printed on it, so it usually settles this.</div>'
    +'<button class="backask-btn" id="backBtn" onclick="pickBack()">&#128247; Add the back &amp; rescan</button>'
  +'</div>';
}

function pickBack(){
  var inp = document.getElementById('backInput');
  if(inp) inp.click();
}

async function rescanWithBack(f){
  if(!frontFile || !f || backPending) return;
  backPending = true;
  backFile = f;
  var btn = document.getElementById('backBtn');
  if(btn){ btn.disabled = true; btn.textContent = '\u23f3 Rescanning with both sides\u2026'; }
  setStatusStages([
    { msg:'Reading both sides\u2026', after:0 },
    { msg:'Finding real sold prices\u2026', after:2600 }
  ]);
  if(window.ttq) ttq.track('Search',{content_type:'card_scan',content_name:'rescan_with_back'});if(window.fbq)fbq('track','Search',{content_type:'card_scan',content_name:'rescan_with_back'});
  try{
    var fd = new FormData();
    fd.append('front', frontFile);
    fd.append('back', f);
    if(cgIsOwner()) fd.append('fresh','1');
    var r = await fetch(API+'/api/scan-card',{method:'POST',body:fd});
    if(!r.ok) throw new Error('Server error '+r.status);
    var d = await r.json();
    if(!d.success) throw new Error(d.error||'Rescan failed');
    d.usedBack = true;
    renderResult(d);
    setStatus('','');
  }catch(e){
    setStatus('\u274c '+e.message,'error');
    backFile = null;
    if(btn){ btn.disabled=false; btn.textContent='\ud83d\udcf7 Add the back & rescan'; }
  }
  backPending = false;
}

/* ===== SCAN FEEDBACK =====
   One tap on the result. A thumbs-down asks what went wrong, so the vote
   arrives attached to the card name and the query that produced it. */
var fbSent = false;

async function sendFeedback(vote, reason){
  try{
    await fetch(SB_URL+'/rest/v1/rpc/submit_scan_feedback',{
      method:'POST',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},
      body: JSON.stringify({
        p_vote: vote,
        p_reason: reason || null,
        p_card_name: (lastResult && lastResult.cardName) ? String(lastResult.cardName).slice(0,200) : '',
        p_search_query: String(currentQuery||'').slice(0,300),
        p_listing_count: (lastResult && Array.isArray(lastResult.listings)) ? lastResult.listings.length : 0,
        /* Whether this result came from a two-sided scan. The backend sets
           usedBack on /api/scan-card, and rescanWithBack sets it locally.
           A typed search has no images at all, so it's false — which is
           correct: it wasn't a front-only scan either, and the vote still
           tells us something about query quality. */
        p_used_back: !!(lastResult && lastResult.usedBack)
      })
    });
  }catch(e){}
}

function cgFeedback(vote){
  if(fbSent) return;
  var box=document.getElementById('fbBox');
  if(!box) return;
  if(window.ttq) ttq.track('ClickButton',{content_name:'scan_feedback_'+vote,content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'scan_feedback_'+vote,content_type:'scanner_standalone'});

  if(vote==='up'){
    fbSent=true;
    sendFeedback('up',null);
    box.innerHTML='<div class="fb-thanks">&#128077; Thanks &mdash; that helps.<br>'
      +'<span style="font-size:11.5px">Useful? <b>Send it to someone who asks what their card is worth.</b></span></div>';
    return;
  }

  box.innerHTML='<div class="fb-q">What went wrong?</div>'
    +'<div class="fb-reasons">'
      +'<button class="fb-reason" onclick="cgFeedbackReason(\'wrong_card\')">WRONG CARD</button>'
      +'<button class="fb-reason" onclick="cgFeedbackReason(\'bad_price\')">PRICE LOOKS OFF</button>'
      +'<button class="fb-reason" onclick="cgFeedbackReason(\'too_slow\')">TOO SLOW</button>'
    +'</div>'
    +'<div class="fb-sub">Wrong card? You can fix the search yourself just below.</div>';
}

function cgFeedbackReason(reason){
  if(fbSent) return;
  fbSent=true;
  sendFeedback('down',reason);
  if(window.ttq) ttq.track('ClickButton',{content_name:'scan_feedback_reason_'+reason,content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'scan_feedback_reason_'+reason,content_type:'scanner_standalone'});
  var box=document.getElementById('fbBox');
  if(!box) return;
  var msg = reason==='wrong_card'
      ? 'Try editing the search below &mdash; it re-prices instantly.'
    : reason==='bad_price'
      ? 'Tap the sold-listings link above to see every sale behind that number.'
      : 'Thanks for flagging it.';
  box.innerHTML='<div class="fb-thanks">Got it &mdash; logged.<br><span style="font-size:11.5px">'+msg+'</span></div>';
}

/* ===== SEARCH-WE-RAN: edit + re-price ===== */
function sqEdit(){
  var box=document.getElementById('sqBody');
  if(!box)return;
  box.innerHTML =
    '<input class="sq-input" id="sqInput" value="'+esc(currentQuery)+'" onkeydown="if(event.key===\'Enter\')sqReprice()"/>'
    +'<button class="sq-go" id="sqGo" onclick="sqReprice()">Re-price with this search</button>'
    /* WHAT TO ACTUALLY CHANGE, NOT A GENERAL TIP.

       "year + brand + player + card number + parallel" describes a good
       query but tells nobody which part of THIS one is wrong. The two
       things the scanner gets wrong are the year and the card number,
       and one of them has a specific, repeating cause worth naming.

       Retro-design inserts: 1991 Topps in 2026, 1987 Topps in 2022, the
       Anniversary sets. The model reads the DESIGN year off the front
       rather than the copyright year off the back, so a 2026 insert
       comes back as a 1991 card and the comps vanish. Seen twice in two
       days -- a Drew Gilbert #91B2-40 read as 2023, and a Konnor
       Griffin read as 1987 when he was drafted in 2024.

       Somebody holding the card knows the real year. Telling them where
       to look is worth more than a generic tip. */
    +'<div class="sq-why"><b>Usually it is the year or the card number.</b> '
     +'If your card copies an old design &mdash; a 1991 or 1987 Topps look on a modern card &mdash; '
     +'the scanner often reports the design year instead of the real one. '
     +'Check the copyright line on the back and use that year.</div>';
  var inp=document.getElementById('sqInput');
  if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}
  var btn=document.getElementById('sqEditBtn');
  if(btn){btn.textContent='CANCEL';btn.setAttribute('onclick','sqCancel()');}
}
function sqCancel(){
  if(lastResult) renderResult(lastResult);
}
/* One code path for every re-price: the manual EDIT box and the refinement
   chips both land here. Keeps the scanned image and card meta, swaps in the
   new market data. */
var repricing = false;
async function repriceQuery(q, opts){
  opts = opts || {};
  if(repricing) return false;
  q = String(q||'').trim();
  if(!q){ setStatus('Search can\'t be empty','error'); return false; }
  repricing = true;
  setStatus(opts.statusText || 'Re-pricing…','loading');
  if(window.ttq) ttq.track('Search',{content_name:q,content_type:opts.trackAs||'search_correction'});if(window.fbq)fbq('track','Search',{content_name:q,content_type:opts.trackAs||'search_correction'});
  try{
    /* compact=1 halves the sold-record pull on the backend. A refinement
       is a follow-up on a card we already paid full price for, and a
       median off 50 sales is not meaningfully worse than off 100 — but
       three chip taps at full cost is 4x the budget for one card. */
    var url = API+'/api/card-market?query='+encodeURIComponent(q)
          + (cgIsOwner() ? '&fresh=1' : '')
            + (opts.refined ? '&compact=1' : '');
    var r = await fetch(url);
    if(!r.ok) throw new Error('Server error '+r.status);
    var d = await r.json();
    if(!d.success) throw new Error(d.error||'Search failed');
    var merged = Object.assign({}, d);
    if(lastResult){
      merged.image = d.image || lastResult.image;
      merged.year  = d.year  || lastResult.year;
      merged.brand = d.brand || lastResult.brand;
      merged.set   = d.set   || lastResult.set;
    }
    // A refinement is still the same card, so keep the name we already had.
    merged.cardName = opts.keepName && lastResult && lastResult.cardName
      ? lastResult.cardName : prettyName(q);
    merged.searchQuery = d.searchQuery || q;
    merged.corrected = !!opts.corrected;
    merged.refined   = !!opts.refined;
    renderResult(merged);
    setStatus('','');
    repricing = false;
    return true;
  }catch(e){
    setStatus('❌ '+e.message,'error');
    repricing = false;
    return false;
  }
}

/* The correction write needs nothing but the public key, so it works
   for signed-out visitors too -- which is almost everybody, and
   exactly the population whose corrections are worth having. */
function sbFeedbackReady(){ return !!(SB_URL && SB_KEY); }

async function sqReprice(){
  var inp=document.getElementById('sqInput');
  if(!inp)return;
  var q=(inp.value||'').trim();
  var go=document.getElementById('sqGo');
  if(go){go.disabled=true;go.textContent='⏳ Re-pricing…';}
  // A hand-typed search becomes the new baseline; old chips no longer apply.
  refineActive = null;
  refinePrev = null;
  /* THE CORRECTION IS THE THING WORTH KEEPING.

     A thumbs-down records that a scan was wrong. It does not record
     what the card actually was, so it cannot teach anything -- it is a
     complaint, not a label.

     This box does record it. Somebody who gets a wrong read retypes the
     query until the right card comes back, and that produces a pair:
     what the scanner claimed, and what the person says it is. It is the
     only genuinely proprietary data CardGauge accumulates from ordinary
     use, and until now it was thrown away the moment the re-price ran.

     Fire and forget, before the re-price, so a failed lookup does not
     lose the correction. No user identifier -- this is a record of the
     scanner being wrong, not of a person. */
  try{
    if(lastResult && sbFeedbackReady()){
      fetch(SB_URL+'/rest/v1/rpc/submit_scan_correction',{
        method:'POST',
        headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({
          p_card_name:       String(lastResult.cardName||'').slice(0,200),
          p_search_query:    String(currentQuery||'').slice(0,300),
          p_corrected_query: String(q||'').slice(0,300),
          p_ai_year:         String(lastResult.year||''),
          p_ai_set:          String(lastResult.set||''),
          p_ai_card_number:  String(lastResult.cardNumber||''),
          p_ai_parallel:     String(lastResult.parallel||''),
          p_ai_confidence:   String(lastResult.confidence||''),
          p_used_back:       !!lastResult.usedBack
        })
      }).catch(function(){});
      logEvent('scan_corrected', String(lastResult.cardName||'').slice(0,200), !!lastResult.usedBack);
    }
  }catch(e){}

  var ok = await repriceQuery(q,{
    corrected:true,
    statusText:'Re-pricing \u2014 finding sold comps\u2026',
    trackAs:'search_correction'
  });
  if(!ok && go){ go.disabled=false; go.textContent='Re-price with this search'; }
}

/* ===== REFINEMENT CHIPS =====
   Card number is deliberately NOT one of these. Within a single modern set
   every parallel shares one number — 2018 Topps Chrome Ohtani is #150
   whether it's a base card or a superfractor — so adding it narrows
   nothing. What actually splits a wide spread is grade and parallel, and
   plenty of sellers leave the number out of the title entirely, so
   requiring it would throw away real comps. These chips filter on the
   things that do separate the sales, and each one is built from a count
   that came back in this payload. */
function buildRefine(d, rows){
  if(!spreadFlagged && !refineActive) return '';

  var chips = [];
  var seen = {};

  // Grades that have real data behind them.
  (rows||[]).forEach(function(r){
    if(!r.isReal || !r.count) return;
    var comp = (rows.company || 'PSA');
    var id = comp.toLowerCase()+r.grade;
    if(seen[id]) return; seen[id]=1;
    chips.push({
      id:id,
      label:comp+' '+r.grade,
      suffix:comp.toLowerCase()+' '+r.grade,
      n:r.count + (rows.basis==='sold' ? ' sold' : ' live')
    });
  });

  // Raw, when there are enough raw listings to stand on.
  if(d.raw && d.raw.count >= THIN_RESULT_N && !seen.raw){
    seen.raw = 1;
    chips.push({
      id:'raw',
      label:'Raw only',
      suffix:'-psa -bgs -sgc -cgc -tag -ace -graded -slab',
      n:d.raw.count + ' listings'
    });
  }

  // The parallel the scanner actually identified on this card.
  if(d.parallel && String(d.parallel).trim()){
    var p = String(d.parallel).trim();
    var pid = 'par_'+p.toLowerCase().replace(/[^a-z0-9]+/g,'');
    if(!seen[pid]){
      seen[pid]=1;
      chips.push({ id:pid, label:p, suffix:p.toLowerCase(), n:'' });
    }
  }

  if(!chips.length && !refineActive) return '';

  var html = '<div class="refine">';

  // Thin-result warning takes the top slot — it's the thing to act on.
  if(refineActive){
    var soldN = (d.sold && d.sold.soldCount) ? d.sold.soldCount : 0;
    var listN = Array.isArray(d.listings) ? d.listings.length : 0;
    if(soldN < THIN_RESULT_N && listN < THIN_RESULT_N){
      html += '<div class="refine-thin">&#9888;&#65039; That narrowed it to '
        + (soldN || listN) + ' — too few to price from. '
        + 'Undo it; a wide range beats a made-up number.</div>';
    }
    html += '<div class="refine-state">Filtered to <b>'+esc(refineActive.label)+'</b>. '
      + 'Prices above are for that version only.</div>';
  } else {
    html += '<div class="refine-lbl">Narrow it down</div>';
  }

  html += '<div class="refine-chips">';
  chips.forEach(function(c){
    var on = refineActive && refineActive.id === c.id;
    html += '<button class="refine-chip'+(on?' on':'')+'" '
      + 'onclick="applyRefine(\''+esc(c.id)+'\',\''+esc(c.label).replace(/'/g,"\\'")+'\',\''
      + esc(c.suffix).replace(/'/g,"\\'")+'\')">'
      + '<b>'+esc(c.label)+'</b>'
      + (c.n ? ' <span class="n">'+esc(c.n)+'</span>' : '')
      + '</button>';
  });
  if(refineActive){
    html += '<button class="refine-chip undo" onclick="undoRefine()">&#8592; Undo</button>';
  }
  html += '</div></div>';
  return html;
}

function applyRefine(id, label, suffix){
  if(repricing) return;
  if(refineActive && refineActive.id === id){ undoRefine(); return; }
  if(!refineActive) refinePrev = lastResult;   // first refinement — remember the wide view
  refineActive = { id:id, label:label, suffix:suffix };
  var q = (refineBase || currentQuery) + ' ' + suffix;
  if(window.ttq) ttq.track('ClickButton',{content_name:'refine_'+id,content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'refine_'+id,content_type:'scanner_standalone'});
  repriceQuery(q,{ refined:true, keepName:true, statusText:'Filtering to '+label+'…', trackAs:'search_refine' });
}

function undoRefine(){
  if(repricing) return;
  refineActive = null;
  if(window.ttq) ttq.track('ClickButton',{content_name:'refine_undo',content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'refine_undo',content_type:'scanner_standalone'});
  if(refinePrev){
    var prev = refinePrev;
    refinePrev = null;
    renderResult(prev);
    setStatus('','');
  } else if(refineBase){
    repriceQuery(refineBase,{ keepName:true, statusText:'Restoring the full search…', trackAs:'search_refine_undo' });
  }
}

/* Toggle the full sold range into view when it's been withheld for width. */
function toggleRange(e){
  if(e) e.preventDefault();
  var r=document.getElementById('soldRange');
  if(!r) return;
  var nowHidden = r.classList.toggle('hidden');
  var btn = e && e.currentTarget;
  if(btn) btn.textContent = nowHidden ? 'SHOW FULL RANGE' : 'HIDE FULL RANGE';
}

function computeStats(d){
  var listings=Array.isArray(d.listings)?d.listings:[];
  var prices=listings.map(function(l){return safeNum(l.price);}).filter(function(p){return p>0;}).sort(function(a,b){return a-b;});
  if(!prices.length){
    return {avg:Math.round(safeNum(d.avgPrice||d.avgSoldPrice)),low:Math.round(safeNum(d.lowPrice)),high:Math.round(safeNum(d.highPrice)),cnt:0};
  }
  var n=prices.length,mid=Math.floor(n/2);
  var med=(n%2===0)?((prices[mid-1]+prices[mid])/2):prices[mid];
  var cut=n>=5?Math.floor(n*0.1):0;
  return {avg:Math.round(med),low:Math.round(prices[cut]),high:Math.round(prices[n-1-cut]),cnt:n};
}

/* Build the PSA 7/8/9/10 ladder.

   Rules, in order of authority:
     1. A real median from >=3 live listings is the truth. Never altered.
     2. If the real medians don't rise with grade, the data is mixing
        different cards. Show only the real ones, no estimates, and say so.
     3. Otherwise fill the gaps by interpolating between real anchors, so
        the ladder always rises. With no anchors at all, use the multipliers.  */
function buildRoiRows(d, avgPrice){
  // Sold prices per grade are truer than asking prices. Use them when
  // The Card API returned them; otherwise fall back to eBay ask medians.
  var soldBd = (d.sold && Array.isArray(d.sold.soldGradeBreakdown)) ? d.sold.soldGradeBreakdown : [];
  var bd = soldBd.length ? soldBd : (Array.isArray(d.gradeBreakdown) ? d.gradeBreakdown : []);
  var ladderBasis = soldBd.length ? 'sold' : 'ask';

  var company = dominantCompany(bd);
  var GRADES = GRADE_SCALES[company] || GRADE_SCALES.PSA;

  /* Only this company's grades feed the ladder. Blending a PSA 9 with a
     CGC 9 would be averaging two different markets into one rung. */
  var real = {};
  bd.forEach(function(g){
    var p = parseGradeKey(g.grade);
    if(p.company !== company) return;
    if(GRADES.indexOf(p.value) === -1) return;
    if(!real[p.value] || (g.count || 0) > (real[p.value].count || 0)){
      real[p.value] = { median:g.median, count:g.count, company:p.company };
    }
  });

  var anchors = [];
  GRADES.forEach(function(g,i){
    if(real[g] && real[g].median > 0) anchors.push({ i:i, v:real[g].median });
  });

  // 2 — real data that falls as the grade rises means the query is mixing cards.
  var inconsistent = false;
  for(var a=1;a<anchors.length;a++){
    if(anchors[a].v <= anchors[a-1].v){ inconsistent = true; break; }
  }

  var rows = GRADES.map(function(g,i){
    var r = real[g];
    if(r && r.median > 0){
      return { grade:g, value:r.median, isReal:true, count:r.count, company:r.company };
    }
    return { grade:g, value:0, isReal:false, count:0, company:null, clamped:false };
  });

  rows.company = company;
  rows.grades  = GRADES;
  if(inconsistent){ rows.inconsistent = true; rows.basis = ladderBasis; return rows; }

  /* Fill the gaps.

     These used to extrapolate with hardcoded 0.72 (down) and 1.30 (up)
     multipliers that came from nowhere and disagreed with GRADE_MULTS
     twelve lines above. On a $498 PSA 9 that put the PSA 8 at $359 when
     the table says $249 — a 40% overstatement, in the direction that
     costs somebody $25 and a card. Everything now scales along the one
     curve in GRADE_MULTS, so there's a single source of truth. */
  var ratio = function(iTarget, iAnchor){
    return GRADE_MULTS[GRADES[iTarget]] / GRADE_MULTS[GRADES[iAnchor]];
  };

  rows.forEach(function(row,i){
    if(row.isReal) return;

    var below = null, above = null;
    for(var x=anchors.length-1;x>=0;x--){ if(anchors[x].i < i){ below = anchors[x]; break; } }
    for(var y=0;y<anchors.length;y++){ if(anchors[y].i > i){ above = anchors[y]; break; } }

    if(below && above){
      /* Interpolate along the multiplier curve rather than along the grade
         index, so the step from 9 to 10 stays the big one it really is.
         Monotonic by construction: the curve rises and above.v > below.v. */
      var mLo = GRADE_MULTS[GRADES[below.i]], mHi = GRADE_MULTS[GRADES[above.i]];
      var frac = (GRADE_MULTS[row.grade] - mLo) / (mHi - mLo);
      row.value = Math.round(below.v + (above.v - below.v) * frac);
      row.clamped = true;
      row.from = GRADES[Math.abs(i-below.i) <= Math.abs(above.i-i) ? below.i : above.i];
    } else if(above){
      row.value = Math.round(above.v * ratio(i, above.i));
      row.clamped = true;
      row.from = GRADES[above.i];
    } else if(below){
      row.value = Math.round(below.v * ratio(i, below.i));
      row.clamped = true;
      row.from = GRADES[below.i];
    } else {
      row.value = Math.round(avgPrice * GRADE_MULTS[row.grade]);
    }
    if(row.value < 1) row.value = 0;
  });

  rows.basis = ladderBasis;
  return rows;
}

/* ===== SOLD PRICE BLOCK =====
   When The Card API returns real sold data, that becomes the headline and
   the asking prices move to a secondary row. Sold is what buyers actually
   paid; asks are what sellers hope for.

   The raw range is withheld when it's absurdly wide. An $18–$715 spread on
   a $125 median doesn't inform anyone — it just makes the median look like
   a guess, when the real story is that the search is catching several
   different cards. Say that, and point at the fix. */
/* Only speaks up when the catalog disagrees with the read. Silence here
   is the normal, correct case and should stay silent. */
/* Silent unless the source told us how each sale happened, and unless
   there is more than one kind. An empty breakdown is worse than none. */
/* REAL LISTING THUMBNAILS, NOT JUST AN OUTBOUND LINK.

   d.listings already carries an image, price and url for every eBay
   listing behind this card's price -- the backend returns it on every
   scan, but nothing on this page ever showed it. A shop owner (or any
   collector) clicking "Shop this card on eBay" today lands on a search
   results page and has to re-find the actual card among however many
   other listings match the query. Showing a few real photos and prices
   right here lets them see what's actually for sale before they leave
   the page at all.

   Capped at 6 -- enough to give a real sense of the market without
   turning the result card into a marketplace grid. Only listings with
   both an image and a price are shown; a listing missing either would
   render as a broken thumbnail or a blank price, which is worse than
   not showing it at all. Each thumbnail's onerror removes itself
   rather than showing a broken-image icon, in case an eBay image URL
   has gone stale by the time someone views the page. */
function buildListingThumbs(d){
  var items = (d && d.listings) || [];
  items = items.filter(function(x){ return x && x.image && safeNum(x.price); });
  if(!items.length) return '';
  items = items.slice(0, 6);

  var cards = items.map(function(x){
    return '<a class="lthumb" href="'+esc(x.url||'#')+'" target="_blank" rel="noopener nofollow sponsored" '
      + 'onclick="affClick(\'listing_thumb\')">'
      + '<img src="'+esc(x.image)+'" alt="" loading="lazy" onerror="this.closest(\'.lthumb\').remove()"/>'
      + (x.graded ? '<span class="lthumb-badge">'+esc(x.gradeCompany||'GRADED')+(x.gradeValue?' '+esc(x.gradeValue):'')+'</span>' : '')
      + '<span class="lthumb-price">'+fmtMoney(x.price)+'</span>'
      + '</a>';
  }).join('');

  return '<div class="lthumbs-label">Actual listings for this card</div>'
    + '<div class="lthumbs">' + cards + '</div>';
}

function buildListingMix(d){
  var m = d && d.sold && d.sold.listingMix;
  if(!m || !m.total) return '';

  var seg = [
    { n:m.auction,   c:'#22c55e', label:'auction' },
    { n:m.bestOffer, c:'#3b82f6', label:'best offer' },
    { n:m.fixed,     c:'#f59e0b', label:'fixed price' },
    { n:m.other,     c:'#2a3a55', label:'other' }
  ].filter(function(x){ return x.n > 0; });
  if(seg.length < 2 && !m.note) return '';

  return '<div class="mix">'
    + '<div class="mix-bar">' + seg.map(function(x){
        return '<i style="width:' + ((x.n/m.total)*100) + '%;background:' + x.c + '"></i>';
      }).join('') + '</div>'
    + '<div class="mix-key">' + seg.map(function(x){
        return '<span><i style="background:' + x.c + '"></i>' + x.n + ' ' + x.label + '</span>';
      }).join('') + '</div>'
    + (m.note ? '<div class="mix-note' + (m.note.indexOf('sellers asked') > -1 ? ' warn' : '')
        + '">' + esc(m.note) + '</div>' : '')
  + '</div>';
}

/* Title-case a word without mangling the things that are not words.
   Roman numerals, card numbers, grader names and suffixes like RC or
   VMAX are already correct and must survive untouched. */
var KEEP_UPPER = /^(RC|SP|SSP|GU|MEM|AUTO|PSA|BGS|SGC|CGC|TAG|NM|MT|VMAX|VSTAR|GX|EX|LV|HP|MLB|NBA|NFL|NHL|UFC|WWE|II|III|IV|VI|VII|VIII|IX|XI|XII)$/i;
function titleWord(w){
  if(!w) return w;
  if(/\d/.test(w)) return w;                       // 2018, #US285, 4/102
  if(KEEP_UPPER.test(w)) return w.toUpperCase();
  if(w.length <= 2 && w === w.toUpperCase()) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/* The header, assembled from what was parsed rather than what was
   typed. Same output whether the card came from a photo or the search
   box. */
/* eBay is asked for 100 listings and returns at most 100. A count
   sitting exactly on the ceiling is a ceiling, not a total \u2014 printing
   it as "100 listed now" states as fact something we simply stopped
   counting. Same reasoning as the sold count printing "100+". */
var EBAY_CAP = 100;
function listedLabel(n){
  var v = Number(n) || 0;
  return (v >= EBAY_CAP ? EBAY_CAP + '+' : v) + ' listed now';
}

function buildTitle(d){
  if(!d) return '';
  var parts = [];
  var yr = parseInt(d.year, 10);
  if(yr >= 1860 && yr <= 2100) parts.push(String(yr));

  /* notJunk strips "Base Set", which is correct on a sports card \u2014
     nobody writes it and it is a description, not a product. In Pokemon
     it is the NAME of the 1999 set and the most collected set in the
     hobby, so stripping it here turned "1999 Pokemon Base Set
     Charizard" into "1999 Pokemon Charizard". Same distinction the
     server already draws when deciding what to store. */
  var isPoke = /pok/i.test(String(d.sport||'') + ' ' + String(d.brand||'') + ' ' + String(d.set||''));
  var keep = function(v){
    if(!v) return false;
    if(isPoke) return !/^(unknown|n\/a|na|none|null|-|\?)$/i.test(String(v).trim());
    return notJunk(v);
  };

  /* "2021 Topps Topps Chrome 70th Anniversary Nolan Ryan".

     The dedupe below compares WHOLE strings, so a brand of "Topps" and
     a set of "Topps Chrome 70th Anniversary" are different keys and
     both get pushed. Sets are routinely named with the brand in front
     -- Topps Chrome, Bowman Chrome, Panini Prizm -- so this stutters
     on a large share of cards and the stutter goes into the query too.

     Narrow on purpose: the brand is dropped ONLY when the set already
     begins with it. A word-level dedupe was tried once before and
     turned "Panini Prizm ... Silver Prizm" into "... Silver",
     destroying the parallel. This cannot do that -- it removes a
     leading duplicate and touches nothing else. */
  var brandTxt = String(d.brand || '').trim();
  var setTxt   = String(d.set || '').trim();
  var dropBrand = !!(brandTxt && setTxt
    && setTxt.toLowerCase().indexOf(brandTxt.toLowerCase() + ' ') === 0);

  var seen = {};
  [dropBrand ? '' : d.brand, d.set, d.player].forEach(function(v){
    if(!keep(v)) return;
    var t = String(v).trim().split(/\s+/).map(titleWord).join(' ');
    var k = t.toLowerCase();
    if(seen[k]) return;                              // "Bowman" as both brand and set
    seen[k] = 1;
    parts.push(t);
  });

  if(parts.length < 2) return '';                    // not enough to beat the raw string

  var out = parts.join(' ');
  if(notJunk(d.cardNumber)){
    var n = String(d.cardNumber).trim();
    out += ' #' + n.replace(/^#/, '');
  }
  if(notJunk(d.parallel)) out += ' ' + String(d.parallel).trim().split(/\s+/).map(titleWord).join(' ');

  /* AUTO AND PATCH WERE READ, USED, AND NEVER SHOWN.

     isAutograph and isPatch already change the search -- the server
     appends "auto" and "patch" to the query, and notTheCard(query) then
     sees them and stops filtering signed and relic sales out of the
     comps. That machinery works.

     What was missing is that the person could not SEE any of it. A
     relic card came back named as if it were the base card, so the one
     way to notice a wrong flag -- and to correct it -- did not exist.
     The scanner knew something about the card and kept it to itself.

     Named the way listings name them, since that is what the query
     carries and what the comps will be: "Auto", "Patch". */
  if(d.isAutograph) out += ' Auto';
  if(d.isPatch)     out += ' Patch';
  if(d.isRookie && String(d.sport||'').toLowerCase().indexOf('pok') === -1) out += ' RC';
  return out;
}

/* SAY WHEN THE CATALOG AGREED, NOT ONLY WHEN IT DIDN'T.

   The warning above fires on a bad match and stays silent otherwise,
   on the reasoning that a green tick on every correct scan becomes
   wallpaper. That reasoning still holds for a badge.

   But silence conflates two very different states. A card the catalog
   confirmed and a card the catalog could not be asked about currently
   look identical, and the second one is the weaker answer. It also
   means the one independent check on identification is invisible --
   including to the person paying for it.

   So: one quiet line, in the same monospace as the search string
   below it, saying which of the three actually happened. Not a badge,
   not coloured, not near the price. Information, in the place where
   someone goes looking for how the answer was reached. */
function buildVerifyLine(d){
  var v = d && d.verified;
  if(!v) return '';

  /* Couldn't ask -- no card number read, catalog unreachable, or the
     add-on lapsed. Worth saying, because it is the difference between
     "checked and fine" and "not checked". */
  if(!v.checked){
    return '<div class="vline vline-off">Card catalog: not checked'
      + (v.note ? ' \u2014 ' + esc(v.note) : '') + '</div>';
  }

  /* The warning covers the bad cases; this covers the good one. */
  if(v.exists === true && v.confidence !== 'low'){
    return '<div class="vline vline-ok">\u2713 Confirmed in the card catalog'
      + (v.yearCorrected
          ? ' \u2014 year corrected to ' + esc(String(v.yearCorrected.to))
          : '')
      + '</div>';
  }
  return '';
}

function buildVerifyWarning(d){
  var v = d && d.verified;
  if(!v || !v.checked) return '';
  if(v.exists === true && v.confidence !== 'low') return '';
  if(!v.note) return '';

  return '<div class="vwarn">'
    + '<span class="ico">&#9888;&#65039;</span>'
    + '<span><b>This might not be the right card.</b> ' + esc(v.note)
    + '<span class="fix">The prices below are for the card as read above \u2014 '
    + 'if that is wrong, so are they.</span></span>'
  + '</div>';
}

/* The other half of buildVerifyWarning. Only fires when the catalog
   was actually able to check (a card number was read, the set exists,
   the number matched, and the player on it agrees) — otherwise this
   says nothing, same as the warning does when there's nothing to
   check. Never claims certainty the catalog didn't confirm. */
function buildVerifyBadge(d){
  var v = d && d.verified;
  if(!v || !v.checked) return '';
  if(v.exists !== true || v.confidence === 'low') return '';
  return '<span class="vgood">&#9989; Card number verified</span>';
}

/* ── THE ACTUAL SALES, NOT JUST THE MEDIAN ──────────────────────

   The server has been sending up to twelve real sold records with
   every result -- price, date, listing type, grader, grade, title and
   a link -- and the page read exactly one field out of them, to find
   a last-sale price. Everything else was thrown away.

   Ludex's heaviest reviewer, the one who scanned seven thousand cards,
   says the recent-sales list is his favourite part of their app: he
   looks for the highest sale and works from that listing. That is not
   a preference about layout. For somebody deciding what to ask, the
   spread of real sales IS the answer and the median is a summary of
   it.

   A median also hides the thing a seller most wants to see. "$1"
   tells you nothing about whether one copy went for $8 last Tuesday.
   The list does.

   COLLAPSED TO FIVE. Twelve rows below a price is a wall, and the top
   few are what people read. The rest is one tap away, and the count is
   on the button so nobody has to guess whether it is worth it.

   Every row links to the listing it came from. That is the same
   principle as the sold-comps link that already exists: the number is
   checkable, and we would rather people checked. */
function buildSalesList(d){
  var sold = d && d.sold;
  var rows = (sold && Array.isArray(sold.sales)) ? sold.sales : [];
  rows = rows.filter(function(x){ return Number(x.price) > 0; });
  if(rows.length < 2) return '';   // one sale is not a list

  /* MOST RECENT FIRST, NOT HIGHEST FIRST.

     Sorting by price looked right in isolation and was wrong in place.
     A real result: the headline read $2 -- a median across 100+ sales
     -- and the five rows underneath it read $21, $8, $7, $6, $6,
     because those were the top of the twelve the server returns. The
     page appeared to contradict itself, and the contradiction was
     entirely an artefact of how this list was ordered.

     Date order cannot do that. The rows are a sample of what has been
     happening lately, so they scatter either side of the median the
     way a sample should, and the top sale is still visible -- just not
     promoted to the front where it reads as the answer.

     The count line below says how many of how many, because twelve
     rows under a median of a hundred sales is a sample and should not
     look like the whole story. */
  rows = rows.slice().sort(function(a,b){
    var da = a.saleDate ? Date.parse(a.saleDate) : 0;
    var db = b.saleDate ? Date.parse(b.saleDate) : 0;
    if(db !== da) return db - da;
    return Number(b.price) - Number(a.price);   // same day: bigger first
  });

  var typeLabel = function(t){
    var s = String(t || '').toLowerCase();
    if(s.indexOf('auction') > -1) return 'auction';
    if(s.indexOf('offer')   > -1) return 'best offer';
    if(s.indexOf('fixed')   > -1 || s.indexOf('bin') > -1) return 'buy it now';
    return '';
  };
  var shortDate = function(v){
    if(!v) return '';
    try{
      var dt = new Date(v);
      if(isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    }catch(e){ return ''; }
  };

  var row = function(x, hidden){
    var grade = (x.grader && x.grade) ? (esc(x.grader) + ' ' + esc(x.grade)) : '';
    var inner = '<span class="sl-p">' + fmtMoney(x.price) + '</span>'
      + '<span class="sl-m">'
        + (grade ? '<b class="sl-g">' + grade + '</b> ' : '')
        + esc(shortDate(x.saleDate))
        + (typeLabel(x.listingType) ? ' \u00b7 ' + typeLabel(x.listingType) : '')
      + '</span>';
    return x.url
      ? '<a class="sl-row' + (hidden ? ' sl-hid' : '') + '" href="' + esc(x.url)
        + '" target="_blank" rel="noopener sponsored" '
        + 'onclick="logEvent(\'sale_row_clicked\',null,false)">' + inner + '</a>'
      : '<div class="sl-row' + (hidden ? ' sl-hid' : '') + '">' + inner + '</div>';
  };

  var visible = rows.slice(0, 5).map(function(x){ return row(x, false); }).join('');
  var rest    = rows.slice(5).map(function(x){ return row(x, true); }).join('');

  /* "WHAT EACH ONE ACTUALLY SOLD FOR" claimed the list was every sale.
     It is up to twelve of them. Says which now. */
  var total = Number((sold && sold.soldCount) || 0);
  var label = 'RECENT SALES'
    + (total > rows.length ? ' \u00b7 ' + rows.length + ' OF ' + total : '');

  return '<div class="sl" id="salesList">'
    + '<div class="sl-t">' + label + '</div>'
    + visible + rest
    + (rest
        ? '<button class="sl-more" onclick="showAllSales()">Show all '
          + rows.length + ' sales</button>'
        : '')
    + '</div>';
}

function showAllSales(){
  var box = document.getElementById('salesList');
  if(!box) return;
  box.querySelectorAll('.sl-hid').forEach(function(el){ el.classList.remove('sl-hid'); });
  var b = box.querySelector('.sl-more');
  if(b) b.remove();
  logEvent('sales_list_expanded', null, false);
}

function buildSoldHero(d){
  var sold = d.sold;
  if(!sold || !sold.soldCount || sold.rateLimited) return '';

  var med = safeNum(sold.soldMedian);
  var lo  = safeNum(sold.soldLow);
  var hi  = safeNum(sold.soldHigh);

  /* The server now says outright when the pool it priced from isn't one
     card — either too few confirmed base sales survived the filter, or
     the raw median landed too close to the PSA 9 for both to describe
     the same thing. That verdict beats anything this page can infer
     from the range, because the server saw the individual sales and we
     only see a summary.

     It rides the SAME flag as the local spread check, which is what
     makes it reach everything downstream: the deal callout goes quiet,
     the "that's your number" line withholds itself, the refinement
     chips appear, the sell block is suppressed, and the EDIT box lights
     up. One flag, five behaviours. */
  var contaminated = !!sold.soldContaminated;

  spreadFlagged = contaminated || (med > 0 && (
    (hi > 0 && hi / med >= WIDE_SPREAD_X) ||
    (lo > 0 && med / lo >= WIDE_SPREAD_X)
  ));

  var lookback = sold.lookbackDays || 14;
  var whenNote = sold.lastSaleDate ? ('last sale '+sold.lastSaleDate) : '';
  var basisTag = contaminated
    ? '<span class="sold-basis mixed">MIXED</span>'
    : (sold.soldBasis === 'raw'
        ? '<span class="sold-basis">RAW</span>'
        : (sold.soldGraded && sold.soldGraded.count ? '<span class="sold-basis">MIXED</span>' : ''));

  var rangeHtml = (lo > 0 || hi > 0)
    ? '<div class="sold-range'+(spreadFlagged?' hidden':'')+'" id="soldRange">range <b>'
        +fmtMoney(lo)+'</b> &ndash; <b>'+fmtMoney(hi)+'</b></div>'
    : '';

  /* One warning, not two. When the server has explained WHY the pool is
     mixed, its reason is more specific than "prices are all over the
     place" — and printing both makes the page sound unsure of itself. */
  var spreadHtml = '';
  if(contaminated){
    spreadHtml = '<div class="sold-mixed">&#9888;&#65039; <b>This number is mixing versions.</b> '
      + esc(sold.soldWarning || 'The recent sales look like more than one version of this card.')
      + ((sold.soldUngradedCount)
          ? ' <span style="opacity:.85">('+sold.soldBaseCount+' of '+sold.soldUngradedCount
            +' ungraded sales confirmed as the base card.)</span>' : '')
      + '<button class="sold-range-toggle" onclick="toggleRange(event)" '
      + 'style="display:block;margin-top:9px">SHOW FULL RANGE</button>'
      + '</div>';
  } else if(spreadFlagged){
    spreadHtml = '<div class="sold-spread">'
        +'<div class="sold-spread-t">&#9888;&#65039; Sale prices are all over the place &mdash; '
        +'this search is catching several versions of the card. '
        +'Pick one below to see what that version really goes for.</div>'
        +'<button class="sold-range-toggle" onclick="toggleRange(event)">SHOW FULL RANGE</button>'
      +'</div>';
  }

  /* A HEADER THAT PROMISES A NUMBER MUST NOT SIT ABOVE A BLANK.

     On a limited result the server deliberately returns soldMedian 0 --
     it refuses to publish a median built on one or two sales, which is
     correct. But the panel still rendered "What it actually sold for"
     in a confident green box with a dash where the price should be.
     The refusal was right and the presentation made it look broken.

     So when there is no number, the label stops claiming there is one
     and the panel says what it actually knows: how many sales exist,
     and what the most recent one went for if there was one at all. */
  var haveMed = med > 0;
  var lastPrice = 0;
  try {
    var recent = (sold.sales || []).filter(function(x){ return Number(x.price) > 0; });
    if(recent.length) lastPrice = Number(recent[0].price);
  } catch(e){}

  var heroLabel = !haveMed
    ? 'Too few sales to call a price'
    : (contaminated ? 'What these sales say \u2014 but read on'
                    : 'What it actually sold for');

  var heroVal = haveMed
    ? fmtMoney(med) + basisTag
    : (lastPrice ? '<span class="sold-hero-est">' + fmtMoney(lastPrice) + '</span>'
                   + '<span class="sold-basis">LAST SALE</span>'
                 : '<span class="sold-hero-est">\u2014</span>');

  /* "Median of 1 real sales" was wrong twice in four words: a median of
     one sale is not a median, and "sales" does not agree with 1. */
  /* A COUNT LINE MUST NOT CONTRADICT THE HEADER ABOVE IT.

     The header reads "Too few sales to call a price" whenever
     haveMed is false. This only special-cased nSold === 1, so a card
     with a hundred sales whose median was withheld -- because the
     base filter left too little behind -- printed "Median of 100+
     real sales" directly under a header saying there were not
     enough. Both sentences describe the same result and only one of
     them can be true.

     There is no median to report when haveMed is false, so it stops
     using the word. It says how many sales were found, and why that
     still is not a price. */
  var nSold = Number(sold.soldCount || 0);
  var countPhrase;
  if(!haveMed){
    countPhrase = nSold === 1
      ? 'Just <b>1</b> real sale found'
      : '<b>' + soldCountLabel(nSold, sold.limitUsed) + '</b> sales found, but too few '
        + 'of them are this exact card to call a price';
  }
  /* THERE WAS NO ELSE, AND THE ELSE IS THE COMMON CASE.

     countPhrase was declared here and assigned only inside the
     !haveMed branch, so every card that actually got a price -- the
     path this whole page exists for -- concatenated the word
     "undefined" into the sentence under the headline number:
     "undefined, incl. 4 accepted best offers - past 30 days."

     Refusals read correctly, which is why it survived: the failure
     path was the one being tested.

     The count is the BASE POOL the median rests on, not sold.soldCount.
     soldCount is everything the search returned, including the graded
     copies and other parallels CompGuard threw out -- quoting it beside
     a median built from a filtered subset is the same mismatched-
     populations error the range fix had to undo. Same selection the
     nightly price write uses, so the two can never disagree. */
  else {
    var baseN = Number(
      (sold.soldRaw && sold.soldRaw.count >= 3 ? sold.soldRaw.count : 0)
      || sold.soldCountUsed || nSold || 0);
    countPhrase = baseN === 1
      ? 'From <b>1</b> real sale'
      : 'Median of <b>' + baseN + '</b> real sales';
  }

  /* WHICH CARD IS THIS NUMBER FOR.

     When no completed sales match the full description, the backend
     walks buildQueryTiers() and prices from a broader search instead --
     the base card rather than the Green Parallel. That recovers an
     answer on lookups that used to return nothing, and it answers a
     DIFFERENT QUESTION from the one asked.

     Silently swapping in a wider pool is what every other pricing tool
     does. Saying so is the whole reason this one exists, so the notice
     sits above the number rather than in a footnote below it: somebody
     who reads only the big figure has still been told.

     Only renders when the backend actually broadened. A direct hit
     looks exactly as it did. */
  var broadenHTML = '';
  if (sold && sold.broadenedTo) {
    broadenHTML =
      '<div class="broadened">'
      + '<b>Not the exact card.</b> No completed sales matched the full '
      + 'description, so this is priced from a broader search &mdash; '
      + '<span class="broadened-q">' + esc(sold.broadenedTo) + '</span>. '
      + 'Check that describes what you are holding.'
      + '</div>';
  }

  /* FRANK ASKED, AND HE WAS RIGHT.

     Asked on Facebook 13 Sept whether the number includes shipping,
     tax, buyer's premium and card fees. It does not -- it is the sale
     price, and a $100 comp can land nearer $110 delivered.

     The sold-comps provider returns price, title, date, listing type,
     grader, grade and print run. No shipping field, so a delivered
     figure cannot be computed without inventing one, which is the
     thing this page refuses to do everywhere else.

     So it says what the number is instead. No buyer's premium applies
     -- these are eBay sales, not auction houses -- and the seller side
     IS handled: fees and postage come out before BuyMax gives a
     ceiling. That is a different panel, and it already works. */
  var priceScopeHTML = haveMed
    ? '<div class="price-scope">Sale price &mdash; shipping and tax not included.</div>'
    : '';

  return '<div class="sold-hero'+(contaminated?' mixed':'')+(haveMed?'':' thin')+'">'
    +'<div class="sold-hero-lbl">&#9679; '+heroLabel+'</div>'
    + broadenHTML
    +'<div class="sold-hero-val">'+heroVal+'</div>'
    + priceScopeHTML
    +(spreadFlagged ? spreadHtml + rangeHtml : rangeHtml)
    +'<div class="sold-hero-sub">'+countPhrase
      +(sold.bestOfferCount ? ', incl. <b>'+sold.bestOfferCount+'</b> accepted best offers' : '')
      +' &middot; past '+lookback+' days'
      +(whenNote ? ' &middot; '+whenNote : '')+'.</div>'
    /* Under the count line, inside the same block. The receipt belongs
       with the number it explains, not as another full-width panel --
       this screen was deliberately cut down and should stay that way. */
    +compGuardHTML(sold)
    /* Under the receipt, same block. Somebody who doubts the number
       taps the count; the sales it came from are right there. */
    +salesChartHTML(sold)
  +'</div>';
}


/* ── WHAT WAS LEFT OUT, AND WHY ──────────────────────────────────

   The rejection rules have run on every scan for months. Fourteen
   autographs, six of a different parallel, a PSA 9 -- all correctly
   thrown out of a base-card median, and none of it ever reached the
   screen. The person saw a number and, when the pool was bad, a
   warning. They never saw the work.

   THE HEADLINE IS THE PRODUCT. "31 of 47 sales verified" is a stronger
   and more defensible claim than "$84", because it says what the
   number is made of. Filtering comps by grade and parallel is not a
   moat -- Card Ladder, Market Movers and eBay's own price guide all do
   it. Showing the person which sales were discarded, and for what
   reason, is the part nobody else does.

   "VERIFIED", NEVER "EXACT". These sales passed the rejection rules.
   That is a weaker claim than establishing identical identity, and the
   weaker claim is the true one.

   GRADED SALES ARE EXCLUDED, NOT REJECTED. A PSA 9 is not the wrong
   card -- it is a different condition of the same card. The server
   already labels them separately and this keeps that distinction,
   because calling a graded sale "rejected" would be a small lie in a
   panel whose whole purpose is not telling them. */
var cgOpen = false;
function toggleCompGuard(){
  cgOpen = !cgOpen;
  var l = document.getElementById('cgLine'), b = document.getElementById('cgBody');
  if(l) l.classList.toggle('open', cgOpen);
  if(b) b.classList.toggle('open', cgOpen);
  if(cgOpen) logEvent('compguard_opened', String((lastResult && lastResult.cardName) || '').slice(0,120), false);
}

/* ── 30 DAYS OF ACTUAL SALES ───────────────────────────────────────

   Every sale in the comp response carries a saleDate and a price, and
   until now both were used only to compute a median and then thrown
   away. This draws them.

   NOT A LINE. A line implies a single moving price and invites reading
   a trend into twelve points. These are individual transactions --
   different sellers, different conditions, different days -- and a
   scatter says that. Ten sales between $70 and $81 with one at $153 is
   a fact about the market that a line would smooth into a slope.

   WHY IT EARNS THE SPACE. A contaminated pool is invisible in a median
   and unmissable in a scatter. The 2018 Ohtani typed search on 8 Sept
   returned base cards near $10, refractors near $100 and graded
   parallels over $1,000 -- three clusters that a median rendered as
   one authoritative $462. Anybody looking at the dots would have seen
   in a second what the number hid.

   COLLAPSED BY DEFAULT. The result screen already fires six to fifteen
   elements per scan and was deliberately cut down today; this does not
   undo that. It hangs off the sales count, which is the thing somebody
   taps when they doubt the price. Costs nothing until asked for.

   No library. An inline SVG built from data already in the response --
   no extra call, no dependency, and it works with the page's own
   colour variables. */
function salesChartHTML(sold){
  try{
    var sales = (sold && Array.isArray(sold.sales)) ? sold.sales : [];
    var pts = [];
    for(var i=0;i<sales.length;i++){
      var p = Number(sales[i] && sales[i].price);
      var d = sales[i] && sales[i].saleDate ? new Date(sales[i].saleDate) : null;
      if(!isFinite(p) || p <= 0 || !d || isNaN(d.getTime())) continue;
      pts.push({ t: d.getTime(), p: p, g: !!sales[i].isGraded });
    }
    /* Under four dots is not a picture of anything. The count line
       above already says how many sales there were. */
    if(pts.length < 4) return '';

    pts.sort(function(a,b){ return a.t - b.t; });
    var t0 = pts[0].t, t1 = pts[pts.length-1].t;
    var span = Math.max(1, t1 - t0);

    var prices = pts.map(function(x){ return x.p; });
    var lo = Math.min.apply(null, prices);
    var hi = Math.max.apply(null, prices);

    /* LOG SCALE WHEN THE RANGE IS WIDE. On a clean card linear is
       easier to read. On a contaminated one -- $8 base cards beside
       $10,000 parallels -- linear collapses every real sale onto the
       floor and shows a single dot at the top, which hides exactly the
       thing worth seeing. */
    var useLog = hi / Math.max(lo, 0.01) > 12;
    var f = function(v){ return useLog ? Math.log10(Math.max(v, 0.01)) : v; };
    var fLo = f(lo), fHi = f(hi), fSpan = Math.max(0.0001, fHi - fLo);

    /* Taller and with more room at the left. At 150 high the dots
       crowded the axis and a cluster of similar prices read as one
       smear; the extra 55px separates them without the SVG getting
       wider, since it scales to the container either way. */
    var W = 460, H = 205, L = 52, R = 14, T = 16, B = 30;
    var x = function(t){ return L + ((t - t0) / span) * (W - L - R); };
    var y = function(p){ return T + (1 - (f(p) - fLo) / fSpan) * (H - T - B); };

    var med = Number(sold.soldMedian) || 0;
    var svg = '';

    /* The median drawn behind the dots, so an outlier reads as a
       departure from where the price actually sits. */
    if(med > 0 && med >= lo && med <= hi){
      svg += '<line x1="'+L+'" y1="'+y(med).toFixed(1)+'" x2="'+(W-R)+'" y2="'+y(med).toFixed(1)+'" '
           + 'stroke="var(--green,#22c55e)" stroke-width="1.2" stroke-dasharray="4 3" opacity=".6"/>';
      /* The line was unlabelled, so it read as decoration. It is the
         number in the headline above -- saying so is what connects the
         dots to the price the page is claiming. */
      svg += '<text x="'+(W-R)+'" y="'+(y(med)-5).toFixed(1)+'" font-size="9.5" '
           + 'fill="var(--green,#22c55e)" text-anchor="end" opacity=".85">median '
           + esc(fmtMoney(med)) + '</text>';
    }
    svg += '<line x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(H-B)+'" stroke="var(--line2,#2a3a55)"/>'
         + '<line x1="'+L+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'" stroke="var(--line2,#2a3a55)"/>';

    svg += '<text x="'+(L-6)+'" y="'+(T+4)+'" font-size="9" fill="var(--text3,#64748b)" text-anchor="end">'+fmtMoney(hi)+'</text>'
         + '<text x="'+(L-6)+'" y="'+(H-B)+'" font-size="9" fill="var(--text3,#64748b)" text-anchor="end">'+fmtMoney(lo)+'</text>';

    var dfmt = function(ms){
      var dd = new Date(ms);
      return dd.toLocaleDateString([], {month:'short', day:'numeric'});
    };
    svg += '<text x="'+L+'" y="'+(H-8)+'" font-size="9" fill="var(--text3,#64748b)">'+esc(dfmt(t0))+'</text>'
         + '<text x="'+(W-R)+'" y="'+(H-8)+'" font-size="9" fill="var(--text3,#64748b)" text-anchor="end">'+esc(dfmt(t1))+'</text>';

    /* A LINE, BUT NOT THROUGH EVERYTHING.

       A stock chart's line means one thing moved from here to there.
       These dots are not that: each is a separate transaction, and some
       are graded copies of the same card. Joining a $79 raw sale to a
       $153 PSA 9 would draw a price rise that never happened -- the
       same mixing of populations the sold filter spends this entire
       file refusing to do.

       So the line follows RAW sales only, which is one population and
       the one the headline median describes. Graded dots stay on the
       chart, in gold, off the line.

       Same-day sales are collapsed to their median first. Two copies
       selling on a Tuesday for $70 and $110 is not a spike and a crash;
       it is one day with a spread, and drawing it as two points makes
       the line zigzag on nothing. Collapsing matches what the server
       does when it writes a daily price.

       Three distinct days minimum. Two points is a straight line
       between two sales, which looks like a trend and is not one. */
    var byDay = {};
    for(var q=0;q<pts.length;q++){
      if(pts[q].g) continue;                 /* graded stays off the line */
      var dk = new Date(pts[q].t);
      dk = dk.getFullYear()+'-'+dk.getMonth()+'-'+dk.getDate();
      (byDay[dk] = byDay[dk] || { t: pts[q].t, v: [] }).v.push(pts[q].p);
    }
    var days = Object.keys(byDay).map(function(k){
      var a = byDay[k].v.slice().sort(function(m,n){ return m - n; });
      var mid = Math.floor(a.length/2);
      return { t: byDay[k].t,
               p: a.length % 2 ? a[mid] : (a[mid-1] + a[mid]) / 2,
               n: a.length };
    }).sort(function(a,b){ return a.t - b.t; });

    if(days.length >= 3){
      var d0 = '';
      for(var z=0;z<days.length;z++){
        d0 += (z ? ' L ' : 'M ') + x(days[z].t).toFixed(1) + ' ' + y(days[z].p).toFixed(1);
      }
      svg += '<path d="' + d0 + '" fill="none" stroke="var(--green,#22c55e)" '
           + 'stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>';
      /* Marked so a day built from several sales is visibly sturdier
         than one built from a single transaction -- the difference the
         binder chart had no way to show. */
      for(var z2=0;z2<days.length;z2++){
        svg += '<circle cx="'+x(days[z2].t).toFixed(1)+'" cy="'+y(days[z2].p).toFixed(1)+'" '
             + 'r="'+(days[z2].n > 1 ? 3.5 : 2.5)+'" fill="var(--bg,#0a0e1a)" '
             + 'stroke="var(--green,#22c55e)" stroke-width="2"><title>'
             + esc(fmtMoney(days[z2].p) + ' \u00b7 ' + dfmt(days[z2].t)
                   + ' \u00b7 ' + days[z2].n + (days[z2].n === 1 ? ' sale' : ' sales'))
             + '</title></circle>';
      }
    }

    for(var k=0;k<pts.length;k++){
      /* Graded sales in gold. They are real sales of the card and
         belong on the chart, but they are a different object from a
         raw copy and a reader should be able to tell them apart
         without reading a legend. */
      var col = pts[k].g ? 'var(--gold,#f59e0b)' : 'var(--green,#22c55e)';
      /* Individual sales sit UNDER the line once there is one -- they
         are the evidence, and at full opacity they compete with the
         trend they produced. Graded stays bright: it is a different
         object and should be easy to pick out. */
      var dotOp = (days.length >= 3 && !pts[k].g) ? '.42' : '.85';
      svg += '<circle cx="'+x(pts[k].t).toFixed(1)+'" cy="'+y(pts[k].p).toFixed(1)+'" r="'
           + (days.length >= 3 && !pts[k].g ? '4' : '5') + '" '
           + 'fill="'+col+'" opacity="'+dotOp+'"><title>'+esc(fmtMoney(pts[k].p)+' \u00b7 '+dfmt(pts[k].t))+'</title></circle>';
    }

    var anyGraded = pts.some(function(z){ return z.g; });
    var cid = 'sc-' + Math.random().toString(36).slice(2,8);

    return '<div class="salesc">'
      + '<div class="salesc-t" onclick="var e=document.getElementById(\'' + cid + '\');'
      +   'if(e){var o=e.style.display===\'none\';e.style.display=o?\'block\':\'none\';'
      +   'if(o)logEvent(\'sales_chart_opened\',String(' + pts.length + '),false);}">'
      /* OPEN. The toggle now hides rather than reveals, so the label
         says what is on screen instead of promising something behind a
         tap -- and it carries the window the dots cover, which is the
         question somebody asks of a price chart before any other. */
      +   pts.length + ' real sales'
      +   '<span class="salesc-when">' + esc(dfmt(t0)) + ' \u2013 ' + esc(dfmt(t1)) + '</span>'
      +   '<span>&#9652;</span></div>'
      + '<div id="' + cid + '" style="display:block">'
      +   '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">' + svg + '</svg>'
      +   '<div class="salesc-k">'
      +     (days.length >= 3 ? 'line = raw, by day \u00b7 ' : '')
      +     fmtMoney(lo) + ' low \u00b7 ' + fmtMoney(hi) + ' high'
      +     (useLog ? ' \u00b7 log scale' : '')
      +     (anyGraded ? ' \u00b7 <span style="color:var(--gold,#f59e0b)">gold = graded</span>' : '')
      +   '</div>'
      + '</div>'
      + '</div>';
  }catch(e){ return ''; }
}

function compGuardHTML(sold){
  var g = sold && sold.compGuard;
  if(!g) return '';

  var considered = Number(g.considered || 0);
  var verified   = Number(g.verified || 0);
  var leftOut    = Number(g.leftOut || 0);

  /* Nothing was excluded, so there is nothing to explain. A panel that
     says "0 of 12 left out" is noise on the one screen that should not
     have any. */
  if(!leftOut || !considered) return '';

  var rows = (g.reasons || []).map(function(r){
    return '<div class="cgrow"><span>' + esc(String(r.reason || 'Other'))
      + '</span><span>' + Number(r.count || 0) + '</span></div>';
  }).join('');

  return '<div id="cgLine" class="cgline" onclick="toggleCompGuard()">'
    +   '<span class="arw">&#9654;</span>'
    +   '<span><b>' + verified + '</b> of ' + considered + ' sales verified</span>'
    + '</div>'
    + '<div id="cgBody" class="cgbody">'
    +   '<div class="cgrow" style="color:var(--text2)"><span><b>Left out</b></span>'
    +     '<span>' + leftOut + '</span></div>'
    +   rows
    +   '<div class="cgfoot">Verified means these sales passed our checks \u2014 not that they '
    +     'are provably the identical card. Graded sales are listed as a different condition '
    +     'of the same card, not as the wrong card.</div>'
    + '</div>';
}

function buildAskVsSold(d){
  var a = d.askVsSold;
  if(!a) return '';

  /* When the backend flags a mismatch, the two sides are describing
     different versions of the card and the percentage is meaningless.
     Show the warning instead of a bar — a bar implies a comparison that
     isn't there. */
  if(a.mismatch){
    return '<div class="avs"><div class="avs-note over" style="margin-top:0">'
      +'&#9888;&#65039; '+esc(a.note)+'</div></div>';
  }

  /* Never announce a deal on a page that has just said it cannot tell
     which card these prices belong to.

     Seen live: the top of the result warned the search was catching
     several versions, and the bottom said asking prices were 75% below
     recent sales and there might be a deal. Both cannot be true. A $2
     low against a $70 high is the tell — the cheap listings are almost
     certainly a different version, and pointing somebody at them is
     the one mistake this scanner exists to avoid.

     The comparison still shows, because the numbers are real. What is
     withheld is the CONCLUSION. */
  if(spreadFlagged && a.pct <= -10){
    a = Object.assign({}, a, {
      note: 'Can\'t call this one \u2014 the search is catching several versions of '
          + 'the card, so the gap between asking and sold is comparing different things. '
          + 'Narrow it down above first.'
    });
  }

  var suffix = a.basis === 'raw' ? ' (raw)' : a.basis === 'graded' ? ' (graded)' : '';
  var hi = Math.max(a.ask, a.sold) || 1;
  var soldPct = Math.round((a.sold / hi) * 100);
  /* A withheld conclusion is a caution, not a green light \u2014 the
     colour has to match what the words now say. */
  var cls = (spreadFlagged && a.pct <= -10) ? 'over'
          : a.pct >= 10 ? 'over'
          : a.pct <= -10 ? 'under' : 'fair';
  return '<div class="avs">'
    +'<div class="avs-row">'
      +'<div class="avs-side"><div class="avs-k">Buyers paid'+suffix+'</div><div class="avs-v sold">'+fmtMoney(a.sold)+'</div></div>'
      +'<div class="avs-side"><div class="avs-k">Sellers ask'+suffix+'</div><div class="avs-v ask">'+fmtMoney(a.ask)+'</div></div>'
    +'</div>'
    +'<div class="avs-track"><div class="avs-fill" style="width:'+Math.max(8,soldPct)+'%"></div></div>'
    +'<div class="avs-note '+cls+'">'+esc(a.note)+'</div>'
  +'</div>';
}

/* ===== SELL ONE LIKE THIS =====
   eBay's listing flow, prefilled with the card we just priced.

   VERIFY THIS URL BEFORE TRUSTING IT. eBay's sell endpoints move more
   often than its search ones, and the failure mode is silent: a changed
   path lands somebody on a generic page instead of a prefilled form,
   and nothing on our side would notice. It is one constant on purpose —
   when it breaks, this is the only line to change.

   No campid. EPN pays on purchases, not listings, so tagging a sell
   link would earn nothing and imply an interest we do not have. */

/* EBAY_SELL_URL used to point at ebay.com/sl/sell with sellFlow=PRELIST,
   eBay's private, undocumented listing-prefill page. It broke silently —
   the URL now redirects to eBay's generic "Selling on eBay" marketing
   page instead of a prefilled form. Fixed by pointing at eBay's stable
   PUBLIC search page instead, same one "Shop this card on eBay" already
   uses. From a matching listing, eBay's own "Sell one like this" starts
   a new listing prefilled from that real item. Deliberately untagged —
   the promise here has always been "we take no cut and never see the
   sale." */
function sellLink(query){
  var q = String(query || '').replace(/(^|\s)-\S+/g, '').replace(/\s+/g, ' ').trim();
  return 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(q);
}

/* Only offered when the sold number is one we are willing to stand
   behind. spreadFlagged already carries both the local wide-range check
   and the server's contamination verdict, so there is one gate rather
   than two that can disagree. */
function buildSell(d){
  if(!d.sold || !d.sold.soldCount || d.sold.rateLimited) return '';

  if(spreadFlagged){
    return '<div class="sell-off">Not suggesting a list price on this one \u2014 '
      + '<b>we can\'t tell which version these sales are for.</b><br/>'
      + 'Narrow the search and it comes back.</div>';
  }

  /* Fall back to the ask median rather than silently vanishing. The old
     code returned '' whenever soldMedian happened to be falsy even
     though soldCount was real — a silent, unexplained disappearance
     of the button with no message at all. */
  var med = safeNum(d.sold.soldMedian) || safeNum(d.avgPrice);
  if(!med) return '';

  var basis = safeNum(d.sold.soldMedian) ? 'list around' : 'sellers are asking around';

  /* Opens the review screen rather than jumping straight to eBay.
     sellLink() still only carries a title through as a search
     keyword — a real limit of eBay's simple listing-form URL, not
     something this screen can work around. What changed is giving the
     seller a place to see and edit the title and a generated
     description ON CardGauge first, with an honest "paste this once
     you're there" for the description rather than pretending it flows
     through automatically. */
  return '<button type="button" class="sell" onclick="openReviewListing()" style="width:100%;text-align:left;border:none;cursor:pointer;">'
    + '<span class="sell-row">'
      + '<span class="sell-main">\ud83d\udcb0 Sell one like this \u2014 ' + basis + ' '
      + fmtMoney(med) + '</span>'
      + '<span class="sell-go">\u2197</span>'
    + '</span>'
    + '<span class="sell-sub">Review the title and description on CardGauge first. '
    + '<b>We take no cut and never see the sale.</b></span>'
  + '</button>';
}

/* ===== REVIEW YOUR LISTING =====
   The on-site step between "here's a price" and "here's eBay's form".
   Title and a generated description live here, editable, before
   anything opens in a new tab. */
function generateListingDescription(d){
  var bits = [];
  if(d.cardName) bits.push(d.cardName + '.');

  var soldN = d.sold && d.sold.soldCount;
  var soldMed = d.sold && safeNum(d.sold.soldMedian);
  var lookback = (d.sold && d.sold.lookbackDays) || 14;
  if(soldN && soldMed){
    bits.push('Priced with CardGauge against ' + soldN + ' recent sold comp'
      + (soldN===1?'':'s') + ' \u2014 median sale ' + fmtMoney(soldMed)
      + ' over the last ' + lookback + ' days.');
  } else if(safeNum(d.avgPrice)){
    bits.push('Priced with CardGauge against current asking prices \u2014 typical ask '
      + fmtMoney(d.avgPrice) + '.');
  }

  if(d.gradeValue && d.gradeCompany){
    bits.push(d.gradeCompany + ' ' + d.gradeValue + '.');
  }

  bits.push('Ships securely in a top loader.');
  return bits.join(' ');
}

function openReviewListing(){
  if(!lastResult) return;
  var d = lastResult;
  var med = safeNum(d.sold && d.sold.soldMedian) || safeNum(d.avgPrice) || 0;

  document.getElementById('reviewTitle').value = d.cardName || currentQuery || '';
  document.getElementById('reviewDesc').value = generateListingDescription(d);
  document.getElementById('reviewPrice').textContent = med ? fmtMoney(med) : '\u2014';

  var m = document.getElementById('reviewModal');
  if(m) m.classList.add('show');
  logEvent('review_listing_opened', d.cardName || null, false);
}

function closeReviewListing(){
  var m = document.getElementById('reviewModal');
  if(m) m.classList.remove('show');
}

async function copyListingDescription(){
  var text = document.getElementById('reviewDesc').value;
  var btn = document.getElementById('copyDescBtn');
  try{
    await navigator.clipboard.writeText(text);
    if(btn){ var orig = btn.textContent; btn.textContent = '\u2713 Copied'; setTimeout(function(){ btn.textContent = orig; }, 1800); }
  }catch(e){
    if(btn) btn.textContent = 'Select the text above and copy manually';
  }
  logEvent('listing_description_copied', (lastResult && lastResult.cardName) || null, false);
}

function submitListingToEbay(){
  var title = document.getElementById('reviewTitle').value.trim() || currentQuery;
  onSellClick();
  logEvent('review_listing_to_ebay', title, false);
  window.open(sellLink(title), '_blank', 'noopener');
  closeReviewListing();
}

/* Logged from day one. A feature nobody can measure is a feature nobody
   can decide about later. */
/* ===== AFFILIATE CLICKS =====
   Every one of these already fires a TikTok pixel event, which means
   the counts live in TikTok's dashboard and nowhere you look. eBay and
   Amazon report the other half — whether a click became a purchase
   — but neither will tell you which link on which page sent it.

   This closes the near half. It says nothing about revenue and is not
   meant to: what it answers is whether anybody is clicking these at
   all, which is the question that decides whether a missing commission
   means nobody bought or nobody clicked.

   Own-store clicks are tagged separately. EPN credits the final value
   fee on your OWN listings when traffic arrives through your campid,
   so those are worth more per click than the rest and worth counting
   apart from them. */
function affClick(where){
  try{
    logEvent('affiliate_click', String(where||'').slice(0,60), false);
    if(window.ttq) ttq.track('ClickButton',
      {content_name:'aff_'+where, content_type:'affiliate'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'aff_'+where, content_type:'affiliate'});
  }catch(e){}
}

function onSellClick(){
  try{
    logEvent('sell_click', (lastResult && lastResult.cardName) || currentQuery, false);
    if(window.ttq) ttq.track('ClickButton',
      {content_name:'sell_one_like_this', content_type:'scanner_full'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'sell_one_like_this', content_type:'scanner_full'});
  }catch(e){}
}

/* ═══ THE SESSION BENCH ═══════════════════════════════════════
   See the CSS note. What follows is deliberately small: one array,
   one render, one save loop. No backend, no login required, nothing
   that can fail in a way that costs somebody their result.

   Persisted in sessionStorage rather than held in memory. Somebody
   standing at a card table reloads by accident, or the service worker
   updates under them mid-session — losing six lookups to either would
   be worse than the feature is good. It dies with the tab, which is
   what "this session" means and what the panel says. */

/* ═══ ANONYMOUS SCAN COUNTER ═══════════════════════════════════
   Measurement before any restriction. Logged-out visitors currently
   scan for free, unlimited — this only WATCHES how many photo scans
   somebody runs before signing up, and shows one soft nudge at the
   third. It never blocks a scan.

   Tracks scans specifically, not typed searches — the cost pressure
   this is meant to eventually inform is the OpenAI vision call
   /api/scan-card makes, not the cheaper /api/card-market text lookup.

   sessionStorage, same as the bench: dies with the tab, which is
   correct — this counts scans in ONE VISIT, not a lifetime total.

   Events fired: anonymous_scan_1, anonymous_scan_2, anonymous_scan_3,
   then anonymous_scan_4plus for every scan after that.
   signup_prompt_shown fires once, the moment the milestone nudge is
   actually shown. */
var ANON_SCAN_KEY = 'cg_anon_scan_count';
var ANON_PROMPT_SHOWN_KEY = 'cg_anon_prompt_shown';

function bumpAnonScanCount(){
  var n = 0;
  try{ n = parseInt(sessionStorage.getItem(ANON_SCAN_KEY) || '0', 10) || 0; }catch(e){}
  n += 1;
  try{ sessionStorage.setItem(ANON_SCAN_KEY, String(n)); }catch(e){}
  return n;
}
function anonPromptAlreadyShown(){
  try{ return sessionStorage.getItem(ANON_PROMPT_SHOWN_KEY) === '1'; }catch(e){ return false; }
}
function markAnonPromptShown(){
  try{ sessionStorage.setItem(ANON_PROMPT_SHOWN_KEY, '1'); }catch(e){}
}

var BENCH_KEY = 'cg_bench';
var bench = [];
var benchSaved = false;

function benchLoad(){
  try{
    var raw = sessionStorage.getItem(BENCH_KEY);
    bench = raw ? (JSON.parse(raw) || []) : [];
    if(!Array.isArray(bench)) bench = [];
  }catch(e){ bench = []; }
}
function benchStore(){
  try{ sessionStorage.setItem(BENCH_KEY, JSON.stringify(bench.slice(0,40))); }catch(e){}
}

/* Only what the row needs and what a save needs. The full payload
   carries up to a hundred listings; putting that in sessionStorage
   would blow the quota inside a few lookups and take the bench with
   it. */
function benchAdd(d, s){
  if(!d) return;
  var name = String(d.cardName || '').trim();
  if(!name) return;

  var contaminated = !!(d.sold && d.sold.soldContaminated);
  var soldMed  = safeNum(d.sold && d.sold.soldMedian);
  var soldN    = Number((d.sold && d.sold.soldCount) || 0);

  /* A value we have already refused to vouch for does not get carried
     into the bench as though it were one. The row shows a dash and
     says why, and the total is honest about how many it could price. */
  /* An ask-derived value must not carry a sold count -- that is how
     a row read "$55, 100 sales" when the $55 was what sellers want. */
  var value  = contaminated ? 0 : (soldMed || safeNum(s && s.avg));
  var fromAsk = !contaminated && !soldMed && value > 0;

  var how = contaminated ? 'mixing versions'
          : (d.usedBack ? 'scanned \u00b7 both sides'
          : (frontFile ? 'scanned \u00b7 front only' : 'typed'));

  var item = {
    key:    (name + '|' + (d.searchQuery || '')).toLowerCase(),
    name:   name.slice(0,140),
    how:    how,
    value:  value,
    soldN:  (contaminated || fromAsk) ? 0 : soldN,
    fromAsk: fromAsk,
    contaminated: contaminated,
    query:  String(d.searchQuery || '').slice(0,200),
    image:  d.image || null,
    year:   d.year || null,
    brand:  d.brand || null,
    set:    d.set || null,
    player: d.player || null,
    number: d.cardNumber || null,
    parallel: d.parallel || null,
    sport:  d.sport || null,
    saved:  false
  };

  /* Re-pricing a card, or correcting its search, should update the row
     rather than add a second one — otherwise narrowing a bad result
     leaves both versions sitting there. */
  var at = -1;
  for(var i=0;i<bench.length;i++){
    if(bench[i].name.toLowerCase() === item.name.toLowerCase()){ at = i; break; }
  }
  if(at > -1){
    item.saved = bench[at].saved;
    bench.splice(at,1);
  }
  bench.unshift(item);
  if(bench.length > 40) bench.length = 40;
  benchStore();
}

function benchClear(){
  bench = [];
  benchSaved = false;
  benchStore();
  var el = document.getElementById('benchBox');
  if(el) el.innerHTML = '';
  if(window.ttq) ttq.track('ClickButton',{content_name:'bench_clear',content_type:'scanner'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'bench_clear',content_type:'scanner'});
}

/* Nothing below two. One card is a lookup, not a session, and a
   one-row table with a total under it reads as a bug rather than a
   feature. */
function benchHtml(){
  if(bench.length < 2) return '';

  var priced = bench.filter(function(b){ return b.value > 0; });
  var total  = priced.reduce(function(a,b){ return a + b.value; }, 0);
  var allSaved = bench.every(function(b){ return b.saved; });

  var rows = bench.map(function(b,i){
    var val = b.value > 0
      ? '<div class="bval'+(b.fromAsk?' warn':'')+'">'+fmtMoney(b.value)
        + (b.soldN ? '<small>'+b.soldN+' sales</small>'
                   : (b.fromAsk ? '<small>asking price</small>' : '')) + '</div>'
      : '<div class="bval warn">\u2014<small>'
        + (b.contaminated ? 'not priced' : 'no sales') + '</small></div>';
    return '<div class="brow'+(i===0 && !allSaved ? ' now' : '')+'">'
      + '<div class="bname">'+(b.saved ? '<span class="tick">\u2713</span>' : '')
      + esc(b.name)+'<span>'+esc(b.saved ? 'saved' : b.how)+'</span></div>'
      + val + '</div>';
  }).join('');

  var totLabel = priced.length === bench.length
    ? (bench.length === 2 ? 'Both priced' : 'All '+bench.length+' priced')
    : priced.length + ' of ' + bench.length + ' priced';

  var cta;
  if(allSaved){
    cta = '<div class="bench-cta">'
      /* The step between keeping a card and ever seeing it again. */
      + '<a class="bench-btn done" href="'+BINDER_PAGE+'" target="_blank" rel="noopener"'
      + ' onclick="logEvent(\'open_binder_clicked\',\'bench\',false)">'
      + '\u2713 In your binder \u2014 open it</a>'
      + '<div class="bench-fine">Add what you paid for each and the tracker works out '
      + '<b>what you\'d actually clear after fees.</b></div></div>';
  } else {
    var n = bench.filter(function(b){ return !b.saved; }).length;
    cta = '<div class="bench-cta">'
      + '<button class="bench-btn" id="benchBtn" onclick="benchSaveAll()">\ud83d\udcc2 '
      /* THE LABEL WAS LYING ABOUT NEEDING AN ACCOUNT.

         benchSaveAll() writes straight to local storage and toasts
         "N cards kept on this device". It only calls openAuth() if the
         LOCAL write fails outright. So this button has not required a
         sign-in since the wall came out on 1 Sept -- but it kept
         saying so, which means somebody who does not want an account
         reads it and does not tap. The one action we most want them to
         take, labelled as the thing they came here to avoid.

         Same words either way now, because it does the same thing
         either way. The account ask lives in renderLocalPrompt(),
         AFTER they have cards worth carrying to another phone, which
         is the only point at which it buys them anything. */
      + 'Keep ' + (n === 1 ? 'this card' : 'these ' + n + ' cards')
      + '</button>'
      + '<div class="bench-fine">'
      + (priced.length < bench.length
          ? 'The unpriced ones save too \u2014 <b>narrow the search later and the value fills in.</b> '
          : 'Kept on this device. ')
      /* "First 25 free" is an ACCOUNT limit and this button no longer
         makes an account, so quoting it here answers a question nobody
         asked and implies a cap on something uncapped. */
      + (currentUser ? 'First '+FREE_CARD_LIMIT+' free.' : 'Add an email later to keep them anywhere.')
      + '</div></div>';
  }

  return '<div class="bench">'
    + '<div class="bench-top">'
      + '<div class="bench-t">Your bench <span>\u00b7 '
      + (allSaved ? 'saved to your binder' : 'this session') + '</span></div>'
      + '<div class="bench-n">'+bench.length+' cards</div>'
    + '</div>'
    + rows
    + '<div class="btot"><div class="btot-k">'+totLabel+'</div>'
      + '<div class="btot-v">'+fmtMoney(total)+'</div></div>'
    + cta
    + (allSaved ? '' : '<button class="bench-clear" onclick="benchClear()">CLEAR BENCH</button>')
  + '</div>';
}

/* Logged once per session, the first time the bench is actually on
   screen. Two saves means nothing without knowing how many people saw
   the offer: 2 of 40 is a wrong offer, 2 of 3 is a traffic problem, and
   they need opposite responses. */
var benchShownLogged = false;
var saveOfferLogged  = false;

function benchRender(){
  var el = document.getElementById('benchBox');
  if(!el) return;
  var html = benchHtml();
  el.innerHTML = html;
  if(html && !benchShownLogged){
    benchShownLogged = true;
    logEvent('bench_shown', String(bench.length), false);
  }
}

/* One insert per unsaved card. Sequential rather than parallel: a
   handful of rows is not worth a burst of concurrent writes, and a
   failure halfway through leaves a clear picture of what landed. */
async function benchSaveAll(){
  if(!bench.length) return;
  if(!sbReady()){ toast('Accounts unavailable right now \u2014 scanning still works'); return; }
  if(!currentUser){
    /* SAME GAP AS saveToBinder: the cap is checked below this return.

       The bench writes straight into local storage with no limit at all,
       so eleven cards on the bench became eleven kept cards. This mirrors
       the account branch further down rather than inventing a second set
       of rules: fill the remaining room, save that many, and prompt only
       when there is no room left. Silently saving three of eight and
       saying nothing would be worse than the bug. */
    var localRoom = isPro ? Infinity : Math.max(0, FREE_CARD_LIMIT - localBinder().length);
    var wanted = bench.filter(function(b){ return !b.saved; }).length;
    if(!localRoom && wanted){
      logEvent('local_cap_reached', 'bench');
      toast('That\u2019s ' + FREE_CARD_LIMIT + ' cards on this device \u2014 a free account keeps them all');
      pendingBench = true; openAuth();
      return;
    }

    var kept = 0, failed = 0;
    bench.forEach(function(b){
      if(b.saved) return;
      if(kept >= localRoom) return;          // stop at the free limit
      var arr = localBinder();
      if(arr.some(function(c){ return String(c.name||'').toLowerCase() === String(b.name||'').toLowerCase(); })){ b.saved = true; return; }
      arr.unshift({ name:b.name, image:b.image, price:b.value||null, year:b.year, brand:b.brand,
                    set:b.set, player:b.player, number:b.number, parallel:b.parallel,
                    sport:b.sport, query:b.query, status:'watching', savedAt:new Date().toISOString() });
      if(localBinderWrite(arr)){ b.saved = true; kept++; } else { failed++; }
    });
    if(failed && !kept){ pendingBench = true; openAuth(); return; }
    benchStore(); benchRender();
    toast(kept < wanted
      ? '\u2705 ' + kept + ' kept \u2014 that fills your free ' + FREE_CARD_LIMIT + '. A free account takes the cap off.'
      : '\u2705 ' + kept + ' card' + (kept===1?'':'s') + ' kept on this device');
    logEvent('bench_saved_local', String(kept), false);
    if(kept < wanted) logEvent('local_cap_reached', 'bench_partial');
    renderLocalPrompt();
    return;
  }

  var btn = document.getElementById('benchBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Saving\u2026'; }

  var todo = bench.filter(function(b){ return !b.saved; });
  var done = 0, failed = 0;

  try{
    var n = isPro ? 0 : await watchedCount();
    if(!isPro && n + todo.length > FREE_CARD_LIMIT){
      var room = Math.max(0, FREE_CARD_LIMIT - n);
      if(!room){
        showProWall('bench_save_full');
        if(btn){ btn.disabled=false; benchRender(); }
        return;
      }
      todo = todo.slice(0, room);
      toast('Saving '+room+' \u2014 that fills your free binder');
    }
  }catch(e){}

  for(var i=0;i<todo.length;i++){
    var b = todo[i];
    try{
      var res = await SB.from('watchlist_items').insert({
        user_id:          currentUser.id,
        card_name:        b.name.slice(0,200),
        card_image_url:   b.image || null,
        price_when_added: b.value || null,
        current_price:    b.value || null,
        status:           'watching',
        source:           'scanner',
        last_checked_at:  new Date().toISOString(),
        year:             (parseInt(b.year,10) >= 1860 && parseInt(b.year,10) <= 2100)
                            ? parseInt(b.year,10) : null,
        brand:            benchField(b.brand),
        set_name:         benchField(b.set),
        player:           benchField(b.player),
        card_number:      benchField(b.number),
        parallel:         benchField(b.parallel),
        sport:            benchField(b.sport)
      });
      if(res.error) throw res.error;
      b.saved = true; done++;
    }catch(e){ failed++; }
  }

  benchStore();
  benchSaved = done > 0;
  benchRender();

  if(done) toast('\u2705 '+done+' card'+(done===1?'':'s')+' saved to your binder');
  if(failed) toast('Could not save '+failed+' of them \u2014 try again');
  /* One event per card actually saved, not per click on Save — that's
     the number that answers "how many people who saw the save prompt
     ended up with a card in their binder," which save_offer_shown and
     bench_save alone can't tell apart from a failed or abandoned save. */
  todo.forEach(function(b){
    if(b.saved){
      logEvent('card_saved', b.name || null, false);
      /* Same conversion, bench path. See the note at the single-save
         call. */
      try{ if(window.fbq) fbq('track','AddToWishlist',{content_name:'bench_card_saved',content_type:'product'}); }catch(e){}
      /* Every bench save is status:'watching' — there's no own/watch
         choice in bench mode, just one consolidated save — so these
         all count as watched, consistent with the single-card path's
         card_watched above. */
      logEvent('card_watched', b.name || null, false);
    }
  });
  if(window.ttq && done) ttq.track('AddToWishlist',
    {content_name:'bench_save_'+done, content_type:'scanner_bench'});
  logEvent('bench_save', bench.length ? bench[0].name : null, false);
}

/* Same placeholder rule the single save uses: the AI answers "Unknown"
   for a field it could not read, which is fine to receive and useless
   to store. A null sorts last; the string sorts between T and V and
   looks like a real set name. */
function benchField(v){
  var t = String(v == null ? '' : v).trim();
  return (!t || /^(unknown|n\/a|na|none|null|-|\?)$/i.test(t)) ? null : t.slice(0,120);
}

/* ===== BOTTOM CTA =====
   Reacts to whatever is on screen. Three states:

     - nothing scanned yet: say what this is and what else CardGauge has
     - the card looks worth grading: send them to the pre-screen
     - it doesn't: say so plainly, then point at the binder

   A grading claim is only made off numbers we're willing to defend. The
   panel stays neutral when the grade ladder is inconsistent (that means
   the search is matching more than one card), and when the top grade is
   an estimate rather than a real sale, it says so on the panel. Telling
   someone to spend $25 on the strength of a multiplier we made up is the
   exact thing this scanner exists to argue against. */

const BINDER_URL = '/binder.html';

function ctaHtml(o){
  /* A null panel means "say nothing", not "crash".

     The merged build deliberately makes ctaDefault() return null so the
     generic pitch doesn't run on the site that pitch points at. But the
     no-verdict path still called ctaHtml(ctaDefault()), which then threw
     on o.chips and took the whole panel down \u2014 on the most common
     path, since most cards lack the evidence for a grading verdict. */
  if(!o) return '';
  var chips = (o.chips||[]).map(function(c){
    return '<div class="cg-cta-chip">'+esc(c)+'</div>';
  }).join('');
  return '<div class="cg-cta-eyebrow">'+esc(o.eyebrow)+'</div>'
    +'<h3>'+o.title+'</h3>'
    +'<p>'+o.body+'</p>'
    +(chips?'<div class="cg-cta-tools">'+chips+'</div>':'')
    +'<a class="cg-cta-btn" href="'+o.href+'" target="_top" '
      +'onclick="if(window.ttq)ttq.track(\'ClickButton\',{content_name:\''+o.tag+'\',content_type:\'scanner_standalone\'})">'
      +esc(o.btn)+'</a>'
    /* Every panel needs a way through to the main site. The grading and
       binder panels send their primary button somewhere else, so without
       this the only route to CardGauge was the top bar. */
    +(o.alt?'<a class="cg-cta-alt" href="https://www.cardgauge.com" target="_top" '
      +'onclick="if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'cta_alt_to_cardgauge\',content_type:\'scanner_standalone\'})">'
      +esc(o.alt)+'</a>':'')
    +(o.foot?'<div class="cg-cta-foot">'+o.foot+'</div>':'')
    /* Only under a real result. The default panel \u2014 the one showing
       before anybody has scanned anything \u2014 has nothing to keep. */
    +(o.keep ? keepHtml() : '');
}

/* Where somebody already is decides what this should say. On the
   standalone they are in the app, so the offer is to install it. On the
   Wix page they are on the site, so the offer is to go and get the fast
   one. Saying "add to home screen" from the site would install the site
   \u2014 the Wix wrapper, iframe and all \u2014 which is the slow thing
   dressed up as the fast one. */
function keepHtml(){
  var onStandalone = location.hostname.indexOf('scan.') === 0;
  return onStandalone
    ? '<div class="cg-keep"><span><b>Scanning at a show?</b> Add this to your home screen '
      + 'and it opens straight here \u2014 no browser, no menus.</span></div>'
    : '<div class="cg-keep"><span><b>Scanning at a show?</b> There\'s a stripped-down '
      + 'version for your phone \u2014 just the scanner, opens instantly.</span>'
      /* Same as above -- the two origins now serve one file, so this
         pointed at itself. */
      + '<a href="/scanner.html" rel="noopener" '
      + 'onclick="if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'keep_on_phone_result\',content_type:\'scanner\'})">'
      + 'Put it on my phone \u2192</a></div>';
}

/* On this page the default panel is silence. See note above. */
function ctaDefault(){ return null; }

function ctaDefaultUnused(){
  return {
    eyebrow:'THE REST OF THE TOOLKIT',
    title:'The scanner is one tool.<br/>CardGauge is the rest.',
    body:'Sold comps instead of asking prices, a binder you can share, a tracker that remembers '
        +'what you paid, and a portfolio that shows what all of it actually did.',
    /* Sold comps is the thing they just used — listing it here spends a
       slot telling somebody about the screen they are already on. The
       grade pre-screen is the only tool that answers a DECISION rather
       than showing data, and it was the one missing. */
    chips:['Grade pre-screen','My Binder','Profit tracker','Portfolio','Card show log'],
    btn:'Open CardGauge',
    href:'https://www.cardgauge.com',
    tag:'cta_default_to_cardgauge',
    foot:'Free to start.'
  };
}

function renderCta(d, rows, s){
  var el = document.getElementById('ctaPanel');
  if(!el) return;

  /* THE MARKETING SLAB AT THE BOTTOM IS OFF.

     "THIS WAS A LOOK-UP. THE REST IS A COLLECTION." followed by a
     pitch for the binder, the tracker and the show log -- the largest
     block on a result page and the third place the same account was
     being sold.

     Two blocks now carry the whole message, and that is the design:
       1. The header, at the top of every screen.
       2. One block after the price -- keep the card, then the email or
          the account once there is something worth keeping.

     A third pitch below those does not add a third chance; it makes
     the page longer and cheaper-looking at exactly the point somebody
     has already got what they came for. The links it held all exist in
     the footer and the nav.

     Left as an early return rather than deleted, so it is one line back
     if the numbers ever say the bottom of the page was worth using. */
  el.innerHTML = '';
  el.style.display = 'none';
  if(true) return;

  /* The merged build starts this panel hidden so an empty bordered box
     never flashes on load. Nothing was turning it back on, so once the
     step that did got removed, the panel could write content nobody
     could see \u2014 which is worse than not writing it, because
     everything looks like it worked.

     Visibility is decided by whether there is anything to show, at the
     one place that knows: right here, after the content is built. */
  var show = function(html){
    el.innerHTML = html || '';
    el.style.display = html ? '' : 'none';
  };

  /* No result on screen, or a result with no prices behind it. The tools
     section below already covers this ground, so say nothing — and
     show() hides the box rather than leaving an empty bordered frame. */
  if(!d || !s || !(s.avg > 0)){
    show('');
    return;
  }

  /* What the card is worth ungraded, best source first: a real sold median,
     then a raw ask median with enough listings behind it to mean something,
     then the overall typical ask. */
  var raw = safeNum(d.sold && d.sold.soldMedian)
         || safeNum(d.raw && d.raw.count >= THIN_RESULT_N ? d.raw.median : 0)
         || safeNum(s.avg);

  /* Judge it on the 9, not the 10.

     This used to take the last rung of the ladder — the PSA 10 — and
     ask whether that beat the raw price plus the fee. Almost every card
     clears that bar, because a 10 is worth several times a raw copy of
     nearly anything. But most cards do not come back a 10. Recommending
     a submission on the strength of the best possible outcome is
     telling somebody to gamble and calling it advice.

     The 9 is the honest comparison: it is what a genuinely nice card
     realistically grades. If the maths does not work at a 9, then the
     only version that pays is a coin flip, and that is a "no".

     The 10 is still shown — people want the ceiling — it just no longer
     decides the verdict. */
  var gradeRow = function(want){
    if(!rows || !rows.length) return null;
    for(var i = 0; i < rows.length; i++){
      if(Number(rows[i].grade) === want) return rows[i];
    }
    return null;
  };
  var top     = (rows && rows.length) ? rows[rows.length - 1] : null;  // ceiling, for display
  var verdict = gradeRow(9) || top;                                    // what the maths uses
  var company = (rows && rows.company) || 'PSA';

  /* A grading recommendation has to rest on at least one real sale or
     listing. On a 2-listing card every rung of the ladder is a multiplier
     applied to a guess, and "PSA 10: $137, 6.5x est." off a $21 ask is not
     evidence — it's the same made-up confidence this scanner exists to
     argue against. No real data anywhere in the ladder, or a sample too
     thin to mean anything, and the panel stays out of the grading question
     entirely. */
  var ladderHasReal = !!(rows && rows.some && rows.some(function(r){ return r.isReal; }));

  /* Thin means thin on EVIDENCE, not thin on active listings. A card with
     twenty recorded sales and two people currently listing it is very well
     understood — judging it by the listing count alone threw away the
     better source and silenced the panel on exactly the cards it should
     speak up about. */
  var soldN      = safeNum(d.sold && d.sold.soldCount);
  var evidenceN  = Math.max(soldN, safeNum(s.cnt));
  /* A contaminated pool cannot support a grading recommendation. The
     verdict is (graded value − raw − fee), and if the raw figure is a
     blend of base cards, inserts and refractors, the subtraction is
     meaningless. Better to say nothing than to tell somebody to spend
     $25 on arithmetic the page has already flagged as unreliable. */
  var contaminated = !!(d.sold && d.sold.soldContaminated);

  var thinSample = (evidenceN < THIN_RESULT_N)
                || contaminated
                || d.matchQuality === 'thin'
                || d.matchQuality === 'base_fallback';

  var usable = rows && !rows.inconsistent && top && top.value > 0 && raw > 0
            && ladderHasReal && !thinSample;

  if(usable){
    var topLabel = company + ' ' + top.grade;
    var vLabel   = company + ' ' + verdict.grade;
    var gain     = verdict.value - raw - GRADE_COST;
    var worthIt  = (verdict.value >= raw * GRADE_WORTH_IT_X) && gain > 0;

    var estNote = verdict.isReal
      ? 'That ' + esc(vLabel) + ' figure is a real sale.'
      : 'That ' + esc(vLabel) + ' figure is estimated, not a real sale \u2014 treat it as a ceiling.';

    /* Say which grade the answer rests on. Somebody looking at a large
       PSA 10 number further up the page needs to know the
       recommendation was not built on it. */
    var basisNote = (verdict !== top && top)
      ? ' Worked out on a ' + esc(vLabel) + ' rather than the ' + esc(topLabel)
        + ', because most cards don\u2019t come back a ' + top.grade + '.'
      : '';

    if(worthIt){
      show(ctaHtml({
        eyebrow:'WORTH A SECOND LOOK',
        title:'A ' + esc(vLabel) + ' of this one is around ' + fmtMoney(verdict.value) + '.',
        body:'Ungraded it\u2019s about ' + fmtMoney(raw) + '. Grading runs roughly $' + GRADE_COST
            + ' plus shipping and a long wait, so the card has to actually make the grade for that to pay. '
            + estNote + basisNote,
        chips:['Centering','Corners','Edges','Surface'],
        btn:'Photograph it on the pre-screen',
        href:GRADE_TOOL_URL,
        tag:'cta_grade_prescreen',
      keep:true,
        foot:'Rough gap after fees at a ' + esc(vLabel) + ': ' + fmtMoney(gain)
            + '. The pre-screen reads centering and corners from fresh photos \u2014 '
            + 'it starts blank, so have the card handy. Check sold comps before you submit.'
      }));
      return;
    }

    show(ctaHtml({
      eyebrow:'HONEST ANSWER',
      title:'Not one to grade.',
      body:'A ' + esc(vLabel) + ' is around ' + fmtMoney(verdict.value) + ' and ungraded it\u2019s about '
          + fmtMoney(raw) + '. After the ~$' + GRADE_COST
          + ' fee there isn\u2019t enough left to be worth the wait.'
          + (verdict !== top && top
              ? ' A ' + esc(topLabel) + ' would be about ' + fmtMoney(top.value)
                + ', but that is the ceiling, not the likely outcome.'
              : '')
          + ' Log it, watch it, and revisit if the market moves.',
      chips:['My Binder','Profit tracker','Portfolio'],
      btn:'Track it in My Binder',
      href:BINDER_URL,
      tag:'cta_track_in_binder',
      keep:true,
      foot:'We don\u2019t buy or sell cards, so there\u2019s nothing in it for us either way.'
    }));
    return;
  }

  /* No grading verdict to give. On the standalone the default panel
     still has something to say; on the merged page it is deliberately
     silent. Either way somebody has just scanned a card, so the install
     offer belongs here too \u2014 and this is the path most cards take. */
  var fallback = ctaDefault();
  if(fallback){
    fallback.keep = true;
    show(ctaHtml(fallback));
  } else {
    show(keepHtml());
  }
}

/* One tap back to an empty scanner. Clearing the slots matters more
   than the scroll: leaving the previous card's photos sitting there
   makes it look like the tool is still busy with the last one. */
/* Typical marketplace cost, used only when the person has not told us
   their own. Matches the Business defaults so a shop owner sees the
   same maths in both places. Stated on screen rather than hidden, so a
   seller on different terms knows what to adjust. */
/* ONE POSTAGE FIGURE ON THE PAGE, NOT TWO.

   This said $1 while BuyMax assumed $4 (BUYMAX_DEFAULT_SHIPPING on the
   server), and both numbers appeared on the same result screen about
   eight inches apart -- the decision block's "fees and shipping" line
   and BuyMax's own disclosed assumptions. Whichever is right, they
   cannot both be, and a reader who notices stops trusting both.

   $4 is the one to keep. A card in a sleeve, a toploader and a bubble
   mailer with tracking is not a dollar, and the server has been using
   $4 since BuyMax shipped. Raising this makes the decision block more
   conservative, which is the safe direction for a number somebody
   spends money against. */
var SELL_FEE_PCT = 13, SELL_SHIP = 4;

function buildDecision(d, rows, s){
  var sold = safeNum(d.sold && d.sold.soldMedian);
  var raw  = sold
          || safeNum(d.raw && d.raw.count >= THIN_RESULT_N ? d.raw.median : 0)
          || safeNum(s && s.avg);
  if(!raw) return '';

  /* NO COMPS AND A HANDFUL OF ASKS IS NOT ENOUGH TO ADVISE ON.

     A green /99 autograph came back with no completed sales and ONE
     asking listing -- which turned out to be a sealed hobby box -- and
     this block still printed "Not worth selling on its own, fees and
     postage cost more than the card", with a sell calculation, on the
     same screen as a panel saying CardGauge will not tell you what to
     do with a card it cannot price from real sales.

     Both of those cannot be true. The refusal is the correct one, so
     the recommendation goes. Every other refusal on this page already
     works this way: the price block withholds a median, the list-price
     block withholds a suggestion, the grade ladder withholds estimates.
     A buy/sell/keep verdict is a bigger claim than any of them and
     cannot have a lower bar.

     The ask path still advises when there is a real pool behind it --
     this only refuses when there are no sold comps AND too few asks to
     mean anything. */
  /* s.cnt, NOT s.count. computeStats returns cnt; s.count never
     existed, so this always fell through to d.raw.count -- 1 on a card
     with one raw listing. That printed "only one listing asking for
     it" directly beneath twelve recent sales. */
  var askCount = safeNum(s && s.cnt) || safeNum(d.raw && d.raw.count) || 0;
  if(!sold && askCount < THIN_RESULT_N){
    logEvent('decision_refused', 'asks:' + askCount, false);
    return '<div class="dec-card"><div class="dec-h" style="font-size:15px">'
      + 'Not enough to call this one.</div>'
      + '<div class="dec-note">No completed sales came back, and there '
      + (askCount === 1 ? 'is only one listing' : 'are only ' + askCount + ' listings')
      + ' asking for it. That is not enough to tell you whether to keep it, sell it '
      + 'or grade it \u2014 so we are not going to guess. Narrow the search below, '
      + 'or check the sold listings yourself.</div></div>';
  }

  /* LIMITED AND MIXED ARE NOT THE SAME REFUSAL, AND SAYING SO WRONGLY
     IS WORSE THAN SAYING NOTHING.

     Both used to print "the sales behind that number are describing
     more than one version of this card." That sentence is true of a
     contaminated pool and FALSE of a limited one. The server draws the
     distinction deliberately: soldContaminated means wrong cards are
     still in the pool, soldLimited means the filtering WORKED and what
     survived is too small to price from. Clean comps, just not enough
     of them.

     Telling somebody their comps are mixed when they are actually
     clean sends them off to narrow a search that is already correct,
     and it will not "come back" however they narrow it -- the card has
     one sale, and no phrasing of the query creates a second. */
  if(d.sold && d.sold.soldLimited){
    var n = Number((d.sold && d.sold.soldBaseCount) || 0);
    return '<div class="dec"><div class="dec-off">Not recommending a move on this one \u2014 '
      + '<b>there ' + (n === 1 ? 'is only 1 clean sale' : 'are only ' + n + ' clean sales')
      + ' of this exact card in the last 30 days.</b><br>'
      + 'Nothing wrong with the comps, there just aren\'t enough of them to call a price. '
      + 'Check the asking prices below and judge it yourself.</div></div>';
  }

  if(spreadFlagged){
    return '<div class="dec"><div class="dec-off">Not recommending a move on this one \u2014 '
      + '<b>the sales behind that number are describing more than one version of this card.</b><br>'
      + 'Narrow the search below and it comes back.</div></div>';
  }

  /* FEES COME OFF BOTH SIDES, OR THE COMPARISON IS RIGGED.

     A graded card sells on the same marketplace as a raw one and pays
     the same fee and postage. Subtracting them from the sell figure and
     not from the grading figure makes grading look better than it is --
     by about $30 at a 9 and $80 at a 10 on a card like this. That is
     the one number on the page that talks somebody into spending $25,
     so it is the one that has to be even-handed.

     Both paths are now net of fees, and the recommendation is whichever
     genuinely clears more. */
  /* NO RECOMMENDATION OFF ASKING PRICES.

     When no completed sales are found, raw falls back to the median of
     what sellers are ASKING. That is a ceiling, not a value -- it is
     what nobody has yet paid. 41% of lookups land here.

     Printing "Sell it. You'd clear $34" in bold on top of that, with
     the caveat in small grey text underneath, is exactly the move this
     engine exists to refuse. Almost half of all decision panels would
     have been a confident recommendation built on the weakest number
     the pricing side produces.

     So on ask-only the panel still does the arithmetic -- the figures
     are honest and useful -- but nothing is recommended and nothing is
     bolded as a verdict. It says what the number is and what would
     change it. */
  var askOnly = !sold;

  var netOf = function(v){ return v - (v * SELL_FEE_PCT / 100) - SELL_SHIP; };
  var sellNet = Math.round(netOf(raw));

  var gradeRow = function(want){
    if(!rows || !rows.length) return null;
    for(var i=0;i<rows.length;i++){ if(Number(rows[i].grade)===want) return rows[i]; }
    return null;
  };
  var top     = (rows && rows.length) ? rows[rows.length-1] : null;
  var nine    = gradeRow(9) || top;
  var anyReal = !!(rows && rows.some && rows.some(function(r){ return r.isReal; }));
  var company = (rows && rows.company) || 'PSA';
  var canGrade = anyReal && nine && nine.value > 0 && !(rows && rows.inconsistent);

  /* THE GRADED SIDE HAS TO BE SOLD DATA TOO.

     askOnly already guards the RAW side of the subtraction. Nothing
     guarded the graded side, so a ladder built entirely from live
     listings -- rows.basis === 'ask', which the ladder's own note says
     out loud with "real listings for this card RIGHT NOW" -- could
     still produce "Grade it. Worth a look."

     Seen on a 2025 Chrome Lightning Leaders Ohtani: PSA 9 "sells for"
     $169 off asks, set against a $76 completed-sale median, recommending
     a $25 submission on a $56 edge. Two inches above, this same screen
     said raw asks were running 59% over what buyers actually pay. At
     that discount the $169 is nearer $105 and the edge is mostly gone.

     Subtracting a sold price from an asking price is the one comparison
     this scanner exists to refuse. The arithmetic still shows, because
     the numbers are real -- but it gets no verdict, and the rows stop
     saying "sells for" about a price nobody has paid. */
  var gradeLadderSold = !!(rows && rows.basis === 'sold');

  /* The 9 decides it. Most cards do not come back a 10, and
     recommending a submission on the best possible outcome is telling
     somebody to gamble and calling it advice. The 10 is shown because
     people want the ceiling; it does not get a vote. */
  var gradeNet = canGrade ? Math.round(netOf(nine.value) - GRADE_COST) : 0;
  /* A grading recommendation compares the graded price against the
     raw one. If the raw side is an asking price, the subtraction is
     comparing a real sale to a hope, so no verdict is offered. */
  var gradeWins = canGrade && !askOnly && gradeLadderSold
               && gradeNet > sellNet && nine.value >= raw * GRADE_WORTH_IT_X;

  var cost = safeNum(decCost);
  var line = function(k,v,cls){
    return '<tr><td>'+k+'</td><td'+(cls?' class="'+cls+'"':'')+'>'+v+'</td></tr>';
  };

  /* THE USER'S CARD, NOT A GENERIC ONE.

     d.image is the listing thumbnail the pricing lookup already
     returned -- the same picture used in the result header above. It
     makes the panel read as analysis of THIS card rather than a
     template. Absent on plenty of thin-market cards, so the whole
     block is conditional rather than leaving a broken frame. */
  /* THE PHOTO THEY TOOK, NOT A STRANGER'S LISTING.

     This was d.image -- the eBay thumbnail from the pricing lookup. On
     a card with several parallels that is frequently a different
     version: a Drew Gilbert silver scanned back a pink listing photo
     sitting next to the words "your card". The scan crop is the one
     picture on the page that is unambiguously theirs.

     Falls back to the listing image when there is no scan, which is
     the typed-search path, and to nothing at all when neither
     exists. */
  var ownShot = '';
  try{
    var ft = document.getElementById('frontThumb');
    if(frontFile && ft && ft.src && ft.src.indexOf('blob:') === 0) ownShot = ft.src;
  }catch(e){}
  var imgSrc = ownShot || d.image || '';
  var img = imgSrc
    ? '<img class="dec-img" src="' + esc(imgSrc) + '" alt="" '
      + 'onerror="this.style.display=\'none\'">'
    : '';

  var out = '<div class="dec">'
    + '<div class="dec-top">' + img
      + '<div><div class="dec-k" style="margin:0 0 3px">What to do with it</div>'
      + '<div class="dec-sub">' + esc(prettyName(d.cardName || 'this card')) + '</div></div>'
    + '</div>'

    /* THE INPUT WAS UNDER THE ANSWERS IT CHANGES.

       This box sat at the BOTTOM of the panel, while the two figures it
       feeds -- "You paid" in the sell card and "Up since you bought" in
       the keep card -- render above it. On a phone that means typing
       into a field and watching nothing happen, because the numbers
       that moved are off the top of the screen.

       Worse, the panel changes height when you type: "Up since you
       bought" only renders `if (cost)`, so a new row appears above the
       input and pushes the page down under your thumb.

       Moved above the cards. The question now comes before its answers,
       which is also the order the BuyMax panel already uses -- ask,
       then verdict. Two panels on one screen no longer run in opposite
       directions.

       Still optional. Without it the figures are true, they just answer
       "what will I get" rather than "what did I make". */
    + '<div class="dec-cost">'
      + '<label for="decCostIn">What did you pay for it?</label>'
      + '<input id="decCostIn" type="number" step=".01" placeholder="0.00" value="'
        + (cost || '') + '" oninput="setDecCost(this.value)">'
    + '</div>';

  /* SELL */
  /* POSTAGE CAN COST MORE THAN THE CARD.

     On a $1 card, a 13% fee plus a dollar of postage leaves about
     minus thirteen cents. fmtMoney renders anything at or below zero
     as an em dash, so the headline read "Sell it. You'd clear —." --
     a real answer, told badly, on exactly the dollar-bin cards people
     scan most.

     The answer itself is useful and worth saying plainly: this one is
     not worth posting. And nothing that clears less than nothing gets
     recommended. */
  var clears = sellNet - cost;
  var notWorthPosting = clears <= 0;

  out += '<div class="dec-card'+((gradeWins||askOnly||notWorthPosting)?'':' dec-rec')+'">'
    + ((askOnly||gradeWins||notWorthPosting) ? '' : '<div class="dec-tag">Recommended</div>')
    + '<div class="dec-h">' + (notWorthPosting
        ? 'Not worth selling on its own \u2014 fees and postage cost more than the card.'
        : (askOnly
          ? 'If it sold at the asking price, you\'d clear ' + fmtMoney(clears) + '.'
          : 'Sell it. You\'d clear ' + fmtMoney(clears) + '.')) + '</div>'
    + '<table class="dec-t">'
      + line('Sells for', fmtMoney(raw))
      /* Two decimals here on purpose: rounding $1.13 of fees down
         to $1 against a $1 card is what made the row look wrong. */
      + line('Fees and shipping', '\u2212$' + (raw - sellNet).toFixed(2))
      + (cost ? line('You paid', '\u2212' + fmtMoney(cost)) : '')
    + '</table>'
  + '</div>';

  /* GRADE */
  if(canGrade){
    out += '<div class="dec-card'+(gradeWins?' dec-rec':'')+'">'
      + (gradeWins ? '<div class="dec-tag">Recommended</div>' : '')
      + '<div class="dec-row"><span class="dec-name">Grade it</span>'
      + '<span class="dec-badge '+(gradeWins?'ok':'warn')+'">'
      /* "A bet" says the odds are against it. On an ask-built ladder the
         problem is not the odds, it is that the comparison was never
         valid -- so the badge says which. */
      + (gradeWins ? 'Worth a look' : (gradeLadderSold ? 'A bet' : 'Asking prices only')) + '</span></div>'
      + '<table class="dec-t">'
        /* "Sells for" is a claim about completed sales. When the rung came
           from live listings it is a claim about what somebody hopes to
           get, and the row has to say so. */
        + line(esc(company)+' 9 ' + (gradeLadderSold ? 'sells for' : 'listed at'), fmtMoney(nine.value))
        + (top && top!==nine
            ? line(esc(company)+' '+top.grade+' '+(gradeLadderSold ? 'sells for' : 'listed at'), fmtMoney(top.value))
            : '')
        + line('Fees, shipping, grading', '\u2212' + fmtMoney(nine.value - netOf(nine.value) + GRADE_COST))
        + (cost ? line('You paid', '\u2212' + fmtMoney(cost)) : '')
        + line('<b>' + (gradeLadderSold ? 'At a 9 you clear' : 'At a 9, if it sold at that ask')
               + '</b>', '<b>'+fmtMoney(gradeNet - cost)+'</b>')
      + '</table>'
      + '<div class="dec-fine">'
        + (!gradeLadderSold
            ? 'Those graded figures are what sellers are ASKING right now, not what slabs '
              + 'have sold for \u2014 so this is not a recommendation. Asking prices sit above '
              + 'sold prices, so the real gap is smaller than it looks here. '
            : gradeWins
            ? 'About ' + fmtMoney(gradeNet - sellNet) + ' more than selling it raw \u2014 if it grades a 9. '
            : 'Less than selling it raw once the fee is paid. ')
        + 'Most cards do not come back a ' + (top ? top.grade : '10')
        + ', so treat the top number as a ceiling rather than a plan.'
      + '</div>'
    + '</div>';
  }

  /* KEEP IT.

     Shows only what is actually known. Current value against what the
     person paid is real arithmetic the moment they type a cost.

     A 90-day trend is NOT shown, and the reason is worth recording:
     card_price_history holds 300 rows across 263 different cards --
     roughly one observation each. It is written when somebody scans a
     card, and almost nobody scans the same card twice, so it is a
     scatter of single points rather than a series. The nightly
     watchlist refresh is what would build a real daily series, and it
     writes only for cards someone has SAVED.

     So the honest line is that a trend needs the card in a binder and
     time to pass. Inventing a percentage from one data point would be
     the exact failure the rest of this engine refuses. */
  out += '<div class="dec-card'+((notWorthPosting && !gradeWins && !askOnly)?' dec-rec':'')+'">'
    + ((notWorthPosting && !gradeWins && !askOnly) ? '<div class="dec-tag">Recommended</div>' : '')
    + '<div class="dec-row"><span class="dec-name">Keep it</span></div>'
    + '<table class="dec-t">'
      + line('Worth now', fmtMoney(raw))
      + (cost ? line((raw - cost >= 0 ? 'Up since you bought' : 'Down since you bought'),
            (raw - cost >= 0 ? '+' : '\u2212') + fmtMoney(Math.abs(raw - cost)))
          : '')
    + '</table>'
    + '<div class="dec-fine">No trend yet \u2014 CardGauge needs a few weeks of history '
      + 'before it can tell you which way this card is moving. '
      + '<b>Save it to your binder</b> and the price gets checked nightly.</div>'
  + '</div>';

  out += askOnly
    ? '<div class="dec-off" style="margin-top:11px">No completed sales found, so these figures '
      + 'come from <b>what sellers are asking</b> \u2014 a ceiling, not a value. '
      + 'CardGauge won\'t tell you what to do with a card it can\'t price from real sales. '
      + 'Check the sold listings below, or scan the back if you haven\'t.</div>'
    : '<div class="dec-fine" style="margin-top:10px">Assumes a ' + SELL_FEE_PCT
      + '% marketplace fee and $' + SELL_SHIP + ' postage on any sale, graded or raw. '
      + 'Based on completed sales.</div>';

  return out + '</div>';
}

/* Held in memory only. A purchase price is the person's business, and
   a scanner with no signup should not start remembering it. */
var decCost = 0;
function setDecCost(v){
  decCost = Number(v) || 0;
  if(lastResult){ try{ renderResult(lastResult); }catch(e){} }
  var el = document.getElementById('decCostIn');
  if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

function scanAnother(){
  try{ clearFront(); clearBack(); }catch(e){}
  /* A serial typed on the LAST card must not carry onto the next one.
     Without this the box would claim "Priced as /25" over a price that
     never involved a serial at all. */
  serialAsserted = null;
  yearAsserted   = null;   /* a typed year must not carry to the next card */
  var el = document.querySelector('.scan-card');
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  logEvent('scan_another_clicked', null, false);
  if(window.ttq) ttq.track('ClickButton',{content_name:'scan_another',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'scan_another',content_type:'scanner_page'});
}

/* ── THE CODE ON THE BACK, AND THE BOX TO TYPE IT IN ─────────────

   Topps prints a production code at the bottom of the back. Its last
   three digits say whether the card is base, an SP, an SSP or a
   numbered subset -- and an image-variation SP is identical to the
   base card from the front, so this is often the ONLY way to tell
   without knowing the base photo by heart.

   The manual input is not a fallback, it is the expected path. That
   text is small, low-contrast, and on a Chrome or Prizm back the glare
   lands right on it. The model is told to leave printCode empty rather
   than guess a digit, so most scans will arrive with nothing here and
   a person holding the card can read it in two seconds.

   Says "we don't have the list for this product" wherever that is
   true. A code means nothing without the product's table, and a
   confident wrong answer about a short print misprices the card by a
   multiple. */
/* THREE HEADINGS, THREE BORDERS, THREE PARAGRAPHS, ONE JOB.

   Short print, copyright year and serial number each had their own
   bordered panel with its own title and its own explanation, stacked
   between the price and the eBay link. Roughly two and a half phone
   screens of chrome around three text fields.

   They are one question -- did we read your card right -- so they are
   one box now. Rows share a heading and a label column, which is also
   what makes them scannable: the eye runs down Code / Year / Serial
   instead of re-reading a title for each.

   The explanations are not shortened, they are folded. One "why" opens
   all three, because somebody who wants to know what CODE#CMP means
   wants the same depth for the other two.

   Serial keeps its accent. A numbered card priced as a base card is
   wrong by a multiple, and unlike the other two the field is usually
   EMPTY rather than prefilled -- nothing was read off the photo, so
   nothing draws the eye unless the styling does it.

   The three builders below are untouched and still produce their own
   inputs, ids and handlers. This only changes what wraps them, so
   lookupPrintCode(), applySerial() and the year handler keep working
   against the same element ids. */
function fixBoxHTML(d){
  var rows = [
    { key:'code',   label:'Code',   html: printCodeHTML(d, true) },
    { key:'year',   label:'Year',   html: yearBoxHTML(d,   true) },
    { key:'serial', label:'Serial', html: serialBoxHTML(d, true) }
  ].filter(function(r){ return r.html; });
  if(!rows.length) return '';

  var body = rows.map(function(r){
    return '<div class="fixrow fix-' + r.key + '">'
      +      '<span class="fixlbl">' + r.label + '</span>'
      +      '<div class="fixctl">' + r.html + '</div>'
      +    '</div>';
  }).join('');

  return '<div class="fixbox">'
    + '<div class="fixhead"><span>NOT THE RIGHT CARD? FIX IT</span>'
    +   '<span class="fixtog">why <i>\u25BE</i></span></div>'
    + '<div class="fixsub">Each one re-prices against a narrower search.</div>'
    + body
    + '</div>';
}

function printCodeHTML(d, bare){
  var pc = d && d.printCode;
  var year = (d && d.year) || '', brand = (d && d.brand) || '', set = (d && d.set) || '';
  var body;

  if(pc && pc.known){
    body = '<div class="pcode-v">Code <b>' + esc(pc.code) + '</b> \u2014 '
         + (pc.isBase ? esc(pc.label)
                      : '<span class="pcode-sp">' + esc(pc.label) + '</span>')
         + '<br><span style="font-size:12px;color:var(--text3,#94a3b8)">' + esc(pc.note) + '</span></div>';
  } else {
    body = '<div class="pcode-v" style="font-size:12.5px;color:var(--text3,#94a3b8)">'
         + (pc && pc.code
             ? 'Read <b>' + esc(pc.code) + '</b> off the back. ' + esc(pc.note)
             : 'Topps prints a code at the bottom of the back \u2014 CODE#CMP\u2026 \u2014 and its last '
               + 'three digits say whether this is a short print. Too small to read in most photos.')
         + '</div>'
         + '<div class="pcode-in">'
         /* PREFILLED WITH WHAT WAS READ, NOT WITH AN EXAMPLE.

            The line above says "Read 207 off the back" and the box
            underneath it showed an empty field with 284 greyed out as a
            placeholder. Two different three-digit numbers, six
            millimetres apart, one of them made up -- and the made-up one
            sits where a value goes, so it reads as the answer.

            Reported from a real scan. The read code is now the field's
            value, which also means the common case is one tap on Check
            rather than retyping a number already on screen. The example
            only shows when nothing was read. */
         +   '<input id="pcodeIn" inputmode="numeric" maxlength="3" '
         +     'value="' + esc((pc && pc.code) ? String(pc.code).slice(-3) : '') + '" '
         +     'placeholder="' + ((pc && pc.code) ? '' : '284') + '" '
         +     'onkeydown="if(event.key===\'Enter\')lookupPrintCode()">'
         +   '<button onclick="lookupPrintCode()">Check</button>'
         + '</div>'
         + '<div id="pcodeOut" class="pcode-v" style="font-size:12.5px;margin-top:8px;"></div>';
  }

  if (bare) return body;
  return '<div class="pcode" data-y="' + esc(year) + '" data-b="' + esc(brand) + '" data-s="' + esc(set) + '">'
    + '<div class="pcode-t">CODE#CMP \u2014 SHORT PRINT CHECK</div>' + body + '</div>';
}

async function lookupPrintCode(){
  var box = document.querySelector('.pcode');
  var inp = document.getElementById('pcodeIn');
  var out = document.getElementById('pcodeOut');
  if(!box || !inp || !out) return;
  var code = String(inp.value || '').replace(/[^0-9]/g,'');
  if(code.length < 3){ out.innerHTML = '<span style="color:#f87171">Three digits, from the end of the code.</span>'; return; }

  out.textContent = 'Checking\u2026';
  try{
    var r = await fetch(API + '/api/print-code?code=' + encodeURIComponent(code)
      + '&year='  + encodeURIComponent(box.getAttribute('data-y') || '')
      + '&brand=' + encodeURIComponent(box.getAttribute('data-b') || '')
      + '&set='   + encodeURIComponent(box.getAttribute('data-s') || ''));
    var d = await r.json();
    if(!d || !d.success){ out.innerHTML = '<span style="color:#f87171">Couldn\u2019t check that.</span>'; return; }
    out.innerHTML = d.known
      ? (d.isBase ? '' : '<span class="pcode-sp">') + esc(d.label) + (d.isBase ? '' : '</span>')
        + '<br><span style="color:var(--text3,#94a3b8)">' + esc(d.note) + '</span>'
      : '<span style="color:var(--text3,#94a3b8)">' + esc(d.note) + '</span>';
    logEvent('print_code_checked', code + (d.known ? ' ' + d.label : ' unknown'), false);
  }catch(e){
    out.innerHTML = '<span style="color:#f87171">Couldn\u2019t check that.</span>';
  }
}


/* ── A NUMBERED CARD WHOSE NUMBER THE CAMERA COULDN'T READ ───────

   Serial numbering is printed small, often in foil, and often on the
   same shiny surface the glare lands on. The model is told to leave
   serialNumber empty rather than guess a digit, so plenty of genuinely
   numbered cards arrive here looking like base cards -- and a base
   price on a /25 is wrong by a multiple, not by a margin.

   buildSerialWarning() below only catches the case where a serial WAS
   read and then dropped by the broadening chain. This box catches the
   other case, which is the more common one: nothing was read at all.

   SOMEBODY HOLDING THE CARD CAN READ IT IN TWO SECONDS. Same reasoning
   as the print-code box above -- the manual input is not a fallback,
   it is the expected path.

   A TYPED SERIAL IS HARDER EVIDENCE THAN A READ ONE. The model guesses
   from a photograph; a person is looking at the card. So once somebody
   types /25, a base-card price is not a rough guide for this card, it
   is the price of a different card, and this box says so instead of
   showing it.

   ONLY THE DENOMINATOR IS SEARCHABLE, and this is the easy thing to
   get wrong. In 23/25 the 25 is the print run -- what every copy
   shares, and what sellers put in listing titles. The 23 is which copy
   this one is, and it appears in exactly one listing on earth.
   Searching "23/25" finds nothing on a card that has plenty of comps.
   The numerator is kept for the record and never enters the query.

   Nothing is needed server-side. /api/card-market runs one search
   through normalizeCardQuery(), which leaves a serial alone, and there
   is no tier broadening on that path to drop it -- unlike the scan
   path, which is where the original dropped-serial bug lives. */

var serialAsserted = null;   /* { num, denom, text } once somebody types one */

/* Accepts "23/25", "23 / 25", "/25", "25", "1/1", "one of one".

   Refuses anything shaped like a card number rather than a print run.
   074/073 and 4/102 are Pokemon card numbers, and without these two
   checks every Pokemon scan could push junk into the query. The tells
   are a zero-padded numerator and a numerator larger than the
   denominator -- both impossible for real serial numbering. */

/* ── WHICH PARALLEL IS IT? ───────────────────────────────────────

   The prompt has always asked the model, when it cannot separate two
   parallels that differ only by a colour tint, to name the family and
   list every candidate it cannot rule out in parallelOptions rather
   than picking one. The server has returned that list, plus
   parallelCertain and parallelEvidence, on every scan since.

   Both scanner files ignored all of it. parallelOptions appeared
   nowhere. So the model's honest "it is one of these three" was
   rendered as a single confident answer, and the person had no way to
   see there had been a choice, let alone make it.

   THIS IS THE DIFFERENCE BETWEEN A WRONG ANSWER AND A QUESTION. A
   Refractor and a Superfractor of the same card differ by a hundred
   times in price. Naming the wrong one produces a confident valuation
   that is wrong by orders of magnitude; showing three and letting the
   person point at their own card produces a right one. They are
   holding the card. The model saw a photograph of it.

   Ten of the twelve down-votes on this scanner say "wrong card", not
   "bad price". This is aimed squarely at that. */
function parallelChoiceHTML(d){
  if(!d) return '';
  var opts = Array.isArray(d.parallelOptions) ? d.parallelOptions.filter(Boolean) : [];
  var certain = d.parallelCertain !== false;
  var current = String(d.parallel || '').trim();

  /* Nothing to choose between. A card the model is sure about, or one
     with no alternatives listed, gets no panel -- a chooser with one
     option in it teaches people to ignore the chooser. */
  if(certain && opts.length < 2) return '';
  if(!opts.length) return '';

  /* Evidence, said plainly. 'serial' and 'printed' mean the card told
     us; 'color' and 'uncertain' mean we are reading a sheen in a
     photograph, which is the single most common way this goes wrong. */
  var ev = String(d.parallelEvidence || '').toLowerCase();
  var why = (ev === 'color' || ev === 'uncertain')
    ? 'These differ mainly by tint, and a phone photo often cannot separate them.'
    : 'More than one version matches what we could read.';

  var buttons = opts.map(function(o){
    var name = String(o).trim();
    return '<button class="pvopt' + (name.toLowerCase() === current.toLowerCase() ? ' on' : '')
      + '" onclick="pickParallel(' + JSON.stringify(name).replace(/"/g,'&quot;') + ')">'
      + esc(name) + '</button>';
  }).join('');

  /* Base belongs on the list. A shiny base card mistaken for a parallel
     is the same error in the other direction, and without this the
     person can only choose between parallels they may not have. */
  buttons += '<button class="pvopt base" onclick="pickParallel(\'\')">Base \u2014 no parallel</button>';

  return '<div class="pvbox">'
    + '<div class="pvbox-t">Which one is yours?</div>'
    + '<div class="pvbox-p">We read this as <b>' + esc(current || 'base') + '</b>, but '
    + why + ' Tap the one printed on your card and we\'ll re-price it.</div>'
    + '<div class="pvrow">' + buttons + '</div>'
    + '<div class="pvbox-note">The price above covers what we searched. '
    + 'A different parallel is a different card, often by a wide margin.</div>'
    + '</div>';
}

/* Rebuilds the query with the chosen parallel and re-prices. The old
   parallel is stripped first so repeated corrections cannot stack up
   as "... Refractor Sepia Prism". */
async function pickParallel(name){
  if(!lastResult) return;
  var chosen = String(name || '').trim();
  var was    = String(lastResult.parallel || '').trim();

  logEvent('parallel_picked', (was || 'base') + ' -> ' + (chosen || 'base'), !!lastResult.usedBack);
  /* Only when they actually changed it. Confirming what the model
     already said is not a correction, and recording it as one would
     manufacture agreement for a read nobody disputed. */
  if(chosen && chosen !== was) reportCorrection('parallel', chosen);

  /* Strip the old parallel before adding the new one, or repeated
     corrections stack up: the first version's regex was over-escaped
     and never matched, which produced a query reading
     "... Green Parallel /99 auto Green Parallel" and returned nothing.
     Plain string work is easier to be sure about than a built regex. */
  var q = ' ' + String(currentQuery || '').replace(/\s+/g,' ').trim() + ' ';
  if(was){
    var needle = ' ' + was.toLowerCase() + ' ';
    var lower  = q.toLowerCase();
    var at     = lower.indexOf(needle);
    while(at !== -1){
      q     = q.slice(0, at) + ' ' + q.slice(at + needle.length);
      lower = q.toLowerCase();
      at    = lower.indexOf(needle);
    }
  }
  q = (q + ' ' + chosen).replace(/\s+/g,' ').trim();

  /* The choice is the person's, so it overrides what the model read --
     including on the card name and the chip above. A typed or tapped
     answer is fact; a read one is a question. */
  lastResult.parallel        = chosen;
  lastResult.parallelCertain = true;

  await repriceQuery(q, {
    keepName:   true,
    corrected:  true,
    statusText: chosen ? ('Pricing the ' + chosen + '\u2026') : 'Pricing the base card\u2026',
    trackAs:    'parallel_correction'
  });
}

function parseSerialInput(raw){
  var s = String(raw || '').trim().toLowerCase();
  if(!s) return null;
  if(/^one\s*of\s*one$/.test(s)) return { num:1, denom:1, text:'1/1' };

  var m = s.match(/^(\d{1,5})\s*\/\s*(\d{1,5})$/);
  if(m){
    var num = parseInt(m[1],10), denom = parseInt(m[2],10);
    if(!denom) return null;

    /* MAGNITUDE, NOT PADDING. Print runs are small and round; set
       totals are arbitrary and usually large. 4/102, 25/165 and
       SV107/SV122 are Pokemon CARD NUMBERS -- the card's position in
       its set -- and typing one here would search "/102" and price the
       card against every other card in the set.

       Real serial numbering runs to a print run somebody chose:
       /5, /10, /25, /50, /99, /150, /199, /250, /299, /499, /999.
       Above about 500 it is nearly always a set total, and a
       denominator over 999 is not a print run at all.

       Not a hard block -- somebody holding the card may genuinely have
       a /1000. It asks rather than refuses, because the person can see
       the card and this rule cannot. */
    if(denom > 999){
      return { error:'A print run that big is unusual \u2014 if that is the card\u2019s '
                   + 'NUMBER in its set rather than a serial, leave this blank.' };
    }
    if(denom > 500 && denom % 50 !== 0){
      return { error:'That looks like a card number in a set, not a print run. '
                   + 'Serial numbering is usually /25, /99, /199 and so on.' };
    }

    /* PADDING IS NOT A SIGNAL, AND ASSUMING IT WAS REJECTED REAL CARDS.

       An earlier version here refused any zero-padded numerator on the
       grounds that 074/073 is Pokemon set numbering. Then a real
       visitor hit the dropped-serial warning on a 2026 Bowman Chrome
       Purple Parallel numbered 053/250 -- padded, and a completely
       genuine serial. Cards print 07/99 and 053/250 all the time, and
       a Pokemon card can print 004/102, so padding cannot separate
       them. The old rule would have told somebody reading their own
       card that they had typed it wrong.

       What DOES separate them is impossibility: a copy number cannot
       exceed the print run, which is what makes 074/073 obviously set
       numbering. That check stays.

       Beyond that, trust the person. They are typing into a box
       labelled NUMBERED CARD CHECK while holding the card, which is
       better evidence than anything inferable from the digits. And the
       blast radius is small either way -- only the denominator reaches
       the query. */
    if(num > denom) return { error:'The copy number can\u2019t be higher than the print run.' };
    return { num:num, denom:denom, text:m[1] + '/' + m[2] };
  }

  /* Just the print run -- "/25" or "25". The commonest thing to type,
     because it is the only half that affects a price. */
  m = s.match(/^\/?\s*(\d{1,5})$/);
  if(m){
    var d2 = parseInt(m[1],10);
    if(!d2) return null;
    return { num:null, denom:d2, text:'/' + d2 };
  }
  return { error:'Type it as it\u2019s printed \u2014 23/25, or just /25.' };
}

/* Strip any serial already in the query before adding one, so repeated
   corrections cannot stack up as "... /25 /99". Matches a bare /nn and
   a full nn/nn at token boundaries only -- the card number is already
   folded into currentQuery by this point and has to survive untouched. */
/* Strips a serial that WE added, and nothing else.

   The nn/nn pattern also matches a Pokemon card number -- 4/102 is a
   card's position in its set, not a print run. The old version stripped
   it, so typing a serial on a Pokemon card and then tapping undo
   removed the card number from the query permanently and every
   subsequent search was for the wrong card.

   The bare "/nn" form is safe: nothing but this app puts a lone
   denominator into a query. The full "nn/nn" form is only removed when
   it matches the serial the person actually asserted, which is the only
   one we are entitled to take back out. */
function queryWithoutSerial(q, assertedText){
  var out = String(q || '').replace(/(^|\s)\/\d{1,5}(?=\s|$)/g, '$1');
  var a = String(assertedText || '').trim();
  if(a){
    var esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('(^|\\s)' + esc + '(?=\\s|$)', 'g'), '$1');
  }
  return out.replace(/\s+/g, ' ').trim();
}


/* ── THE YEAR, CORRECTABLE ────────────────────────────────────────

   A WRONG YEAR IS THE MOST EXPENSIVE FIELD ON THE CARD, AND THE ONE
   THE MODEL IS LEAST ABLE TO ADMIT IT CANNOT READ.

   Every other field degrades gracefully when it is wrong. A wrong
   parallel finds the base card. A wrong set broadens the search. A
   wrong year finds NOTHING AT ALL, because the card being searched for
   was never printed -- and the app then falls through to asking
   prices, or to a different card entirely.

   The prompt has been told twice, in detail, to read the copyright
   line and to answer 'Unknown' rather than guess. It does neither on
   the hard cases: the same photo of a 2026 anniversary insert came
   back 2022, then 2021. Two different answers from one card is not a
   misread, it is a guess -- and no further instruction fixes a field
   that is not being read.

   Anniversary and throwback inserts are the worst case. The design
   celebrates an older era, the name contains a number of years, and
   the model reaches for a date that fits the theme instead of the
   copyright.

   So the person fixes it. They are holding the card and the copyright
   line is printed on the back. A typed year is a fact; a read one is a
   question. Same principle as the serial box and the parallel chooser,
   applied to the field where being wrong costs the most. */
var yearAsserted = null;

/* WHAT OTHER PEOPLE CORRECTED ON THIS SAME MISREAD.

   The server returns knownCorrections when at least two people have
   made the identical fix to the identical wrong read. Shown inside the
   box for the field it applies to, not as a seventh panel -- the
   result screen already fires six to fifteen UI elements per scan and
   another one would be noise, however useful.

   Offered, never applied. Somebody else's correction is evidence, not
   authority: they were holding a card that scanned the same way, which
   is good reason to look again and no reason at all to overwrite what
   is in front of this person. Tapping it fills the box; it still takes
   their press to apply. */
function correctionHint(d, field){
  try{
    if(!d || !Array.isArray(d.knownCorrections)) return '';
    var c = d.knownCorrections.filter(function(x){ return x.field === field; })[0];
    if(!c || !c.suggested) return '';
    return '<div class="cg-hint" onclick="applyHint(\'' + field + '\',\''
        + esc(String(c.suggested).replace(/'/g,"")) + '\')">'
      + '<b>' + c.agreement + ' other people</b> scanning this card corrected it to '
      + '<span class="cg-hint-v">' + esc(c.suggested) + '</span>'
      + '<span class="cg-hint-go">use this</span>'
      + '</div>';
  }catch(e){ return ''; }
}

function applyHint(field, value){
  try{
    var id = field === 'year' ? 'yrIn' : (field === 'serial' ? 'serIn' : null);
    if(!id) return;
    var el = document.getElementById(id);
    if(el){ el.value = value; el.focus(); }
    logEvent('correction_hint_used', field + ':' + value, false);
  }catch(e){}
}

function yearBoxHTML(d, bare){
  var read = String((d && d.year) || '').trim();
  var cur  = yearAsserted || read;

  var note = yearAsserted
    ? '<div class="pcode-v">Priced as a <span class="ser-on">' + esc(yearAsserted)
      + '</span> card.</div>'
    : '<div class="pcode-v" style="font-size:12.5px;color:var(--text3,#94a3b8)">'
      + (read
          ? 'We read <b>' + esc(read) + '</b>. The year is in the copyright line at the '
            + 'bottom of the back \u2014 not the year the design is from. Anniversary and '
            + 'throwback inserts are printed in the year they celebrate the anniversary, '
            + 'which is usually recent.'
          : 'We could not read a year. It is in the copyright line at the bottom of the back.')
      + '</div>';

  return '<div class="' + (bare ? 'fixinner' : 'pcode') + '"' + (bare ? '' : ' style="margin-top:11px"') + '>'
    + (bare ? '' : '<div class="pcode-t">YEAR \u2014 COPYRIGHT CHECK</div>')
    + note
    + correctionHint(d, 'year')
    + '<div class="ser-in">'
    +   '<input id="yrIn" inputmode="numeric" maxlength="4" placeholder="2026" '
    +     'value="' + esc(cur) + '" onkeydown="if(event.key===\'Enter\')applyYear()">'
    +   '<button id="yrGo" onclick="applyYear()">Price it</button>'
    + '</div>'
    + (yearAsserted
        ? '<div class="ser-in" style="margin-top:6px">'
          + '<button onclick="clearYear()">Undo \u2014 use what we read</button></div>'
        : '')
    + '</div>';
}

async function applyYear(){
  var el = document.getElementById('yrIn');
  if(!el || !lastResult) return;
  var v = String(el.value || '').trim();

  /* A four-digit year inside the range cards have actually been
     printed in. Rejecting rather than accepting anything typed,
     because a typo here does the same damage as the misread it is
     meant to fix. */
  if(!/^\d{4}$/.test(v)){
    setStatus('Type the four-digit year from the copyright line', 'error');
    return;
  }
  var n = Number(v), now = new Date().getFullYear();
  if(n < 1880 || n > now + 1){
    setStatus('That year is outside the range cards are printed in', 'error');
    return;
  }

  var was = String(lastResult.year || '').trim();
  if(v === was && !yearAsserted){ setStatus('That is what we read already', 'ok'); return; }

  logEvent('year_corrected', (was || 'none') + ' -> ' + v, !!lastResult.usedBack);
  /* Shared so the next person scanning this same misread is offered
     the fix rather than having to find it themselves. */
  reportCorrection('year', v);

  /* Swap the year in the query rather than appending, or a second
     correction leaves both years in the search. Only a standalone
     four-digit token is replaced, so a card number like 2024-BC1
     survives untouched. */
  var q = String(currentQuery || '');
  q = was
    ? q.replace(new RegExp('(^|\\s)' + was + '(?=\\s|$)'), '$1' + v)
    : (v + ' ' + q);
  if(q.indexOf(v) === -1) q = v + ' ' + q;
  q = q.replace(/\s+/g, ' ').trim();

  yearAsserted     = v;
  lastResult.year  = v;

  await repriceQuery(q, {
    keepName:   true,
    corrected:  true,
    statusText: 'Pricing the ' + v + ' card\u2026',
    trackAs:    'year_correction'
  });
}

async function clearYear(){
  if(!yearAsserted || !lastResult) return;
  var was = yearAsserted;
  yearAsserted = null;
  logEvent('year_cleared', was, false);
  renderResult(lastResult);
}

function serialBoxHTML(d, bare){
  var read = String((d && d.serialRead) || '').replace(/^\//,'');
  var body;

  if(serialAsserted){
    /* Somebody has told us the print run. Report what the market said
       about THAT card, and nothing else. */
    var n = (d && Number(d.soldCount)) || 0;
    body = n > 0
      ? '<div class="pcode-v">Priced as <span class="ser-on">'
          + esc(serialAsserted.text) + '</span> \u2014 <b>' + n + '</b> sold '
          + (n === 1 ? 'record' : 'records') + ' for the /'
          + esc(String(serialAsserted.denom)) + ' version.</div>'
      : '<div class="pcode-v"><span class="ser-none">No sales found for /'
          + esc(String(serialAsserted.denom)) + '.</span><br>'
          + '<span style="font-size:12.5px;color:var(--text3,#94a3b8)">Normal for a low print '
          + 'run \u2014 completed sales only go back 30 days and a /'
          + esc(String(serialAsserted.denom)) + ' may simply not have traded in that window. '
          + 'We are not falling back to the base price, because on a numbered card that is '
          + 'a different card rather than a rough guide. Open the sold listings above to '
          + 'look over a wider window yourself.</span></div>';

    if(serialAsserted.num){
      body += '<div class="ser-copy">Recorded as copy ' + esc(String(serialAsserted.num))
            + ' of ' + esc(String(serialAsserted.denom))
            + (serialAsserted.num === 1 && serialAsserted.denom > 1
                ? ' \u00b7 first copy \u2014 often sells for more'
                : '')
            + '. Only the print run is searched.</div>';
    }
    /* THE INPUT STAYS. The first version replaced it with an undo
       button the moment a serial was submitted, so a person who typed
       the wrong thing -- or whose only option WAS the wrong thing,
       before the keypad fix -- had no way to correct it without
       backing out of the whole panel. A correction field that vanishes
       after one use is not a correction field. */
    body += '<div class="ser-in">'
          +   '<input id="serIn" inputmode="text" autocapitalize="off" autocorrect="off" '
          +     'spellcheck="false" maxlength="11" placeholder="23/25" '
          +     'value="' + esc(serialAsserted.text) + '" '
          +     'onkeydown="if(event.key===\'Enter\')applySerial()">'
          +   '<button id="serGo" onclick="applySerial()">Re-price</button>'
          + '</div>'
          + '<div id="serOut" class="pcode-v" style="font-size:12.5px;margin-top:8px;"></div>'
          + '<div class="ser-in" style="margin-top:6px"><button onclick="clearSerial()">'
          +   'Not numbered \u2014 undo</button></div>';

  } else {
    body = '<div class="pcode-v" style="font-size:12.5px;color:var(--text3,#94a3b8)">'
         + (read
             ? 'We read <b>/' + esc(read) + '</b> off the card. Wrong? Type what it actually says.'
             : 'If your card is numbered \u2014 23/25, 07/99 \u2014 type it in. Serial numbering is '
               + 'small and foil-printed, so photos miss it often, and a numbered card priced '
               + 'as a base card is wrong by a multiple.')
         + '</div>'
         + '<div class="ser-in">'
         /* NOT inputmode="numeric". iOS reads that as the digits-only
            keypad, which HAS NO SLASH KEY -- so the one character this
            field is built around could not be typed at all. Found by
            testing a 27/30 card: the only thing enterable was "27",
            which this parser reads as a PRINT RUN of 27 and prices the
            wrong card entirely. Plain text keyboard, digits still
            first on most phones. */
         +   '<input id="serIn" inputmode="text" autocapitalize="off" autocorrect="off" '
         +     'spellcheck="false" maxlength="11" placeholder="23/25" '
         +     'value="' + (read ? '/' + esc(read) : '') + '" '
         +     'onkeydown="if(event.key===\'Enter\')applySerial()">'
         +   '<button id="serGo" onclick="applySerial()">Price it</button>'
         + '</div>'
         + '<div id="serOut" class="pcode-v" style="font-size:12.5px;margin-top:8px;"></div>';
  }

  if (bare) return body;
  return '<div class="pcode"><div class="pcode-t">SERIAL NUMBER \u2014 NUMBERED CARD CHECK</div>'
    + correctionHint(d, 'serial')
    + body + '</div>';
}

async function applySerial(){
  var inp = document.getElementById('serIn');
  var out = document.getElementById('serOut');
  var go  = document.getElementById('serGo');
  if(!inp) return;

  var parsed = parseSerialInput(inp.value);
  if(!parsed || parsed.error){
    if(out) out.innerHTML = '<span style="color:#f87171">'
      + esc((parsed && parsed.error) || 'Type it as it\u2019s printed \u2014 23/25, or just /25.')
      + '</span>';
    return;
  }

  logEvent('serial_typed', parsed.text, !!(lastResult && lastResult.usedBack));
  reportCorrection('serial', parsed.text);
  if(go){ go.disabled = true; go.textContent = 'Pricing\u2026'; }

  serialAsserted = parsed;
  /* Pass what is currently asserted so a re-price replaces it rather
     than stacking a second serial onto the query. */
  var q = queryWithoutSerial(currentQuery, serialAsserted && serialAsserted.text)
        + ' /' + parsed.denom;

  /* keepName so the header stays the card we identified rather than
     becoming a prettified version of the query string. */
  var ok = await repriceQuery(q, {
    keepName:   true,
    corrected:  true,
    statusText: 'Pricing the /' + parsed.denom + '\u2026',
    trackAs:    'serial_correction'
  });

  if(!ok){
    serialAsserted = null;
    if(go){ go.disabled = false; go.textContent = 'Price it'; }
    return;
  }
  logEvent('serial_priced',
    parsed.text + ' sold:' + ((lastResult && Number(lastResult.soldCount)) || 0),
    !!(lastResult && lastResult.usedBack));
}

function clearSerial(){
  if(!serialAsserted) return;
  var back = queryWithoutSerial(currentQuery, serialAsserted && serialAsserted.text);
  serialAsserted = null;
  logEvent('serial_cleared', null, false);
  repriceQuery(back, { keepName:true, statusText:'Back to the full search\u2026',
                       trackAs:'serial_undo' });
}

function renderResult(d){

  /* Can this card be kept at all? An account works without local
     storage; local storage works without an account. Either is enough.
     Only when neither is available does signing in become the ask. */
  var canKeep = !!currentUser || LOCAL_OK;
  /* result_viewed — the broader signal underneath next_action_shown.
     next_action_shown only fires for the narrow case (a single card
     that actually priced) — this fires for EVERY result: bench mode,
     thin/no-price results, all of it. Without this, "did anyone even
     see an answer" isn't measurable separately from "did they see a
     good enough answer to get the action panel." Same object-identity
     dedup as next_action_shown, so an auth-triggered repaint of the
     same result doesn't double-count. */
  if(resultViewedFor !== d){
    resultViewedFor = d;
    logEvent('result_viewed', String((d && d.cardName) || 'Card').slice(0,200), false);
  }
  lastResult = d;
  fbSent = false;
  spreadFlagged = false;
  var el=document.getElementById('result');var s=computeStats(d);
  /* Build the title from the parsed fields, not from whatever the
     person typed.

     A photo scan produces a clean display name, but a typed search
     echoes the raw string straight back — "2018 Topps chrome shohei
     Ohtani Rc" as somebody actually typed it, lowercase and all. The
     structured fields are already there on both paths; using them gives
     the same header whichever way the card arrived.

     Falls back to the raw string when the parser found nothing, because
     a messy title beats an empty one. */
  var cardName = buildTitle(d) || d.cardName || 'Card';
  /* The AI returns "Unknown" for a set it can't read. That's a fine thing
     for the backend to receive and a terrible thing to print next to a
     price — it reads as "we don't know what this card is." Say nothing
     instead. */
  var meta=[d.year,d.brand,d.set].filter(notJunk).join(' · ')||'Trading card';var hasData=s.avg>0;
  currentQuery = d.searchQuery || d.query || cardName;

  /* THE FIX: bench state has to be correct BEFORE any HTML asking
     "keep this card?" gets built, not after. The old order built the
     single-card save button first, using bench.length as it stood
     BEFORE this card was added — so on the second lookup, bench.length
     was still 1 at decision time, the single button rendered, and only
     THEN did the card get added and the real 2-card bench appear
     alongside it. Two save actions, same bug the bench was built to
     prevent, just at a different seam.

     Adding to the bench here, immediately, means every decision below
     — the single button, the bench render, and the save_offer_shown
     log — all read the same, current, correct bench.length. Nothing
     downstream has to guess what state the bench is "about to be in." */
  if(hasData) benchAdd(d, s);

  /* A result that isn't the product of a chip becomes the new baseline that
     chips get appended to, and clears any stale refinement state. */
  if(!d.refined){
    refineBase = currentQuery;
    refineActive = null;
  }

  /* Computed up here rather than down in the ROI section, because the
     refinement chips are built from the same real-grade data.

     THE BASE HAS TO BE THE SOLD MEDIAN, NOT THE ASKING MEDIAN.

     When there are no real per-grade sales to anchor to, the ladder
     falls back to multiplying a base price by the grade multipliers.
     That base was s.avg — the TYPICAL ASK tile — on a page whose
     headline is that the asking price isn't the price.

     A real case: a card with a $12 sold median from 100+ sales and a
     ~$5 typical ask produced a ladder of $6 / $7 / $15 / $33. On the
     sold median it should read roughly $13 / $17 / $35 / $78. That is
     the difference between "not worth grading" and "grade it", and it
     was wrong in the direction that costs somebody a card.

     Sold first, ask only when there are no sales at all. */
  /* A contaminated sold median is worse than an asking median, because
     it carries the authority of "real sales" while describing several
     different cards. When the server flags it, fall through to the ask
     and let the "est." labels do their job. Real per-grade sales still
     anchor the rungs either way; this only sets the fallback. */
  var soldPoisoned = !!(d.sold && d.sold.soldContaminated);
  var ladderBase = (!soldPoisoned && safeNum(d.sold && d.sold.soldRaw && d.sold.soldRaw.count >= THIN_RESULT_N
                             ? d.sold.soldRaw.median : 0))
                || (!soldPoisoned && safeNum(d.sold && d.sold.soldMedian))
                || safeNum(s.avg);
  var rows = buildRoiRows(d, ladderBase);

  var soldUrl = d.soldCompsUrl ? tagEbay(d.soldCompsUrl, true) : ebayLink(currentQuery, true);
  var activeUrl = ebayLink(currentQuery, false);

  var html='<div class="rcard"><div class="rtop">';
  html+=d.image?'<img class="rimg" src="'+d.image+'" onerror="this.outerHTML=\'<div class=rimg-ph>🃏</div>\'"/>':'<div class="rimg-ph">🃏</div>';
  html+='<div><div class="rname">'+esc(cardName)+'</div><div class="rmeta">'+esc(meta)+'</div>';
  html+=buildVerifyBadge(d);
  if(d.parallel&&String(d.parallel).trim()){
    html+='<div class="rparallel">✨ '+esc(d.parallel)+(d.serialNumber?' '+esc(d.serialNumber):'')
      + (d.parallelCertain === false ? ' · UNCONFIRMED' : '') + '</div>';
  }
  html+='</div></div>';
  /* Directly under the header, before any price. The choice changes
     what the price MEANS, so it cannot sit below it. */
  html+=parallelChoiceHTML(d);

  /* IDENTIFICATION BELONGS TO THE CARD, NOT TO WHETHER IT HAS COMPS.

     These four used to sit inside the "we found sold data" branch, so
     a card with no completed sales lost the catalog warning, the
     short-print check and the serial box entirely -- and that is the
     exact card where a wrong read is most likely and correcting it
     matters most. Somebody looking at a price built from one listing
     had no way to tell us which card it actually was.

     They ask "is this the right card". Nothing about that depends on
     whether the right card happens to have sold recently. */
  html+=buildVerifyWarning(d);
  html+=buildVerifyLine(d);

  var haveSold = !!(d.sold && d.sold.soldCount && !d.sold.rateLimited);

  /* THE PRICE IS WHAT THEY CAME FOR. IT GOES FIRST.

     The correction boxes were moved above the price earlier today, to
     fix them vanishing on cards with no comps. That fixed the bug and
     created a worse one: the short-print check and the serial box sat
     between the scan and the number, and the short-print box usually
     says nothing more useful than "we don't have the code list for
     this product yet". Two screens of housekeeping before the answer.

     Warnings still go above -- "this might not be the right card" is a
     caveat ON the price and is worthless after it. Corrections go
     below, because their whole purpose is to be used once somebody has
     seen the number and thinks it is wrong. They still render on every
     card, comps or not, which was the point of this morning's fix. */
  if(hasData){
    // Sold prices lead when we have them.
    if(haveSold){

  html+=buildSerialWarning(d);     // base price on a numbered card
  html+=buildSoldHero(d);          // sets spreadFlagged
      html+=buildSalesList(d);         // the sales behind that median
      html+=buildListingMix(d);        // how those sales happened
      html+=buildRefine(d, rows);      // must follow buildSoldHero
      html+=buildAskVsSold(d);
    }

    // Asking prices: headline if there's no sold data, secondary if there is.
    if(haveSold){
      html+='<div class="rprices" style="opacity:.68">'
        +'<div class="rpbox"><div class="rplabel">LOW ASK</div><div class="rpval low">'+fmtMoney(s.low)+'</div></div>'
        +'<div class="rpbox"><div class="rplabel">TYPICAL ASK</div><div class="rpval" style="color:var(--gold-warm)">'+fmtMoney(s.avg)+'</div><div class="rpsub">'+listedLabel(s.cnt)+'</div></div>'
        +'<div class="rpbox"><div class="rplabel">HIGH ASK</div><div class="rpval high">'+fmtMoney(s.high)+'</div></div>'
        +'</div>';
    } else {
      html+='<div class="rprices">'
        +'<div class="rpbox"><div class="rplabel">LOW ASK</div><div class="rpval low">'+fmtMoney(s.low)+'</div></div>'
        +'<div class="rpbox"><div class="rplabel">TYPICAL ASK</div><div class="rpval main">'+fmtMoney(s.avg)+'</div><div class="rpsub">'+listedLabel(s.cnt)+'</div></div>'
        +'<div class="rpbox"><div class="rplabel">HIGH ASK</div><div class="rpval high">'+fmtMoney(s.high)+'</div></div>'
        +'</div>';
    }

    /* The backend sends its own "these listings vary a lot" note. When our
       spread warning has already fired we'd be telling the user the same
       thing twice in two different voices, so only one speaks at a time. */
    /* THE DECISION, IMMEDIATELY AFTER THE PRICE.

       This was sitting at the very bottom of the result -- below the
       grade ladder, below the save prompt, below Scan another. On a
       phone that is four or five screens of scrolling past the number
       somebody came for, which is the same as not shipping it.

       The price answers "what is it worth". This answers "so what do I
       do", and the two belong together. Everything after it -- the eBay
       links, the thumbnails, the grade ladder -- is supporting evidence
       for a decision the reader has already been given. */
    if(d.isRedemption === true){ html+=buildRedemptionWarning(d); }
    else { html+=buildDecision(d, rows, s); }
    /* BuyMax mounts here after the DOM is written. The div is the whole
       of what the HTML string contributes -- the panel renders itself,
       asks for a price, and posts to /api/buymax for the answer.

       buildBuyLine() used to render here. It is gone, deliberately and
       in the same change: two things computing a buy ceiling on one
       screen is how four separate bugs happened in this codebase in a
       single day. The server is the only place that number is worked
       out now. */
    html+='<div id="bmxMount"></div>';
    html+=buildGlareTip(d);

    /* CORRECTIONS SIT HERE, AFTER THE PRICE, ON EVERY PATH.

       Placing them inside the sold-data branch a moment ago put them
       back where they were this morning: missing from exactly the
       cards with no comps, which are the cards most likely to be
       misidentified. Out here they render whether the price came from
       sales, from asks, or not at all.

       And after the number, not before it. Somebody who has just
       scanned wants the price -- burying it under a short-print box
       that usually says "we don't have the code list for this product
       yet" costs the answer they came for. These are for the second
       look, when the number seems wrong. */
    /* ONE BOX, THREE ROWS -- see fixBoxHTML. */
    html+=fixBoxHTML(d);

    if(d.priceNote && d.matchQuality && d.matchQuality!=='exact' && !spreadFlagged){
      html+='<div class="pnote"><span class="ico">&#9888;&#65039;</span><span>'+esc(d.priceNote)+'</span></div>';
    }

    /* Link priority.

       Without sold data, the sold-comps link IS the value — it's the only
       way the user finds out what the card really goes for, so it stays the
       big blue bar.

       With sold data on screen, that job is done. The prominent link should
       be the one a collector can act on: live listings, with the sold median
       stated as the number to offer. The sold link stays visible directly
       underneath as the check-our-work path — demoted, not hidden. It also
       happens to be the only link here that can pay for the API. */
    if(!haveSold){
      html+='<a class="sold-check" href="'+soldUrl+'" target="_blank" rel="noopener nofollow sponsored" onclick="affClick(\'sold_check\');if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'sold_comps_check\',content_type:\'scanner_standalone\'})">'
        +'<span class="sold-check-main">↗ See what it actually SOLD for</span>'
        +'<span class="sold-check-sub">These are asking prices. Sold comps are the real answer.</span>'
        +'</a>';
    } else {
      /* Do not quote a number the page has just warned about.

         When the spread check fires, the sold median is describing
         several different cards at once — a base card, a parallel and a
         slab averaged together. Saying "buyers are paying around $2,
         that's your number" directly under a warning that the search is
         catching several versions is the page contradicting itself, and
         the confident half is the one people act on.

         Real case: a 2025 Mosaic Jaxson Dart Red and Blue Parallel RC
         showed a $2 raw median because the search pulled base Mosaic
         Darts. The warning fired correctly and the line underneath still
         told somebody $2 was their number. */
      var anchor;
      if (spreadFlagged) {
        anchor = 'Narrow the search above before trusting this number \u2014 '
               + 'right now it is mixing several versions of this card.';
      } else if (d.sold && safeNum(d.sold.soldMedian)) {
        anchor = 'Buyers are paying around '+fmtMoney(d.sold.soldMedian)+'. That\'s your number.';
      } else {
        anchor = 'Live listings for this card.';
      }
      html+='<a class="sold-check" href="'+activeUrl+'" target="_blank" rel="noopener nofollow sponsored" style="margin-top:12px;border-radius:11px 11px 0 0;border-bottom:none" onclick="affClick(\'shop_active\');if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'shop_active_listings\',content_type:\'scanner_standalone\'})">'
        +'<span class="sold-check-main">↗ Shop this card on eBay</span>'
        +'<span class="sold-check-sub">'+esc(anchor)+'</span>'
        +'</a>'
        +'<a class="verify-link" href="'+soldUrl+'" target="_blank" rel="noopener nofollow sponsored" onclick="affClick(\'sold_verify\');if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'sold_comps_verify\',content_type:\'scanner_standalone\'})">'
        +'↗ Or see the sold listings behind that number</a>'
        /* Sits BELOW both buying links on purpose. Most people arrive
           holding a card and wondering what it is worth; only some are
           ready to sell. Putting the sell action above the buy links
           would serve the smaller intent first. */
        +buildSell(d)
        +'<div class="aff-note">eBay links are affiliate links — costs you nothing, and we don\'t set the prices. '
        +'The sell link carries no affiliate tag at all.</div>';
    }

    // See buildListingThumbs() -- shows regardless of whether sold data
    // exists, since it's drawn from active listings either way.
    html+=buildListingThumbs(d);

    /* These two come from live listings, so they are asking prices — even
       when a sold median is on screen above them. Labelling them RAW ASK /
       GRADED ASK keeps "$130 raw ask" from being mistaken for a second,
       contradictory version of the "$125 raw sold" figure up top. */
    var rawG=d.raw, grG=d.graded;
    if(rawG && grG && (rawG.count>0 || grG.count>0)){
      /* A single listing is not a price. Show the count, withhold the number. */
      var splitBox=function(label,g){
        var enough = g && g.count >= 3;
        var val = (!g || !g.count) ? '\u2014' : (enough ? fmtMoney(g.median) : '\u2014');
        var sub = (!g || !g.count) ? 'none found'
                : enough ? (g.count+' listing'+(g.count>1?'s':''))
                : 'only '+g.count+' listing'+(g.count>1?'s':'')+' \u2014 not enough';
        return '<div class="rsplit-box"><div class="rsplit-lbl">'+label+'</div>'
             +'<div class="rsplit-val">'+val+'</div>'
             +'<div class="rsplit-sub">'+sub+'</div></div>';
      };
      html+='<div class="rsplit">'+splitBox('Raw ask',rawG)+splitBox('Graded ask',grG)+'</div>';
    }

    /* The grade ladder header may only claim "SOLD" when every tile on it
       is a real sale. One "est." tile under a header that says ACTUALLY
       SOLD FOR is the same bait-and-switch we built this scanner against. */
    var anyReal=rows.some(function(r){return r.isReal;});
    var allReal=rows.length>0 && rows.every(function(r){return r.isReal;});
    var ladderSold = rows.basis === 'sold';

    /* NO REAL PER-GRADE DATA AND A CONTAMINATED SOLD POOL MEANS THE
       LADDER IS THE ASK TIMES A CURVE -- and the ask is the number this
       page has already told the person is inflated. Refusing here is
       the same judgement the price block and the list-price block
       already make; a grade estimate is a bigger claim than either, so
       it cannot have a lower bar. */
    /* WIDENED after a live test walked straight past it.

       The first version keyed on soldContaminated alone. But the
       warning the person is reading three inches above the ladder --
       "the sales behind that number are describing more than one
       version" -- rides spreadFlagged, which is contaminated OR a wide
       high/low spread. A card can trip the warning without tripping
       contamination, and on the test card it did: the ladder printed
       PSA 7 $11 off a $66 ask while the page said not to trust the
       sales underneath it.

       soldLimited is in here for the same reason. It means the filter
       worked and there are too few clean sales to call a price -- the
       decision block already refuses on it, and a ladder built by
       multiplying one thin number by a curve is a bigger claim than
       the recommendation that just declined to be made.

       Still gated on !anyReal, so a ladder with real per-grade sales
       on it is never suppressed. */
    /* THE HOLE THIS MISSED: NO SOLD DATA AT ALL.

       Every flag below needs sold data to be set. soldLimited means
       "the filter worked and too little survived" -- it cannot fire
       when nothing was fetched. So a card with ZERO completed sales
       skipped all three checks and the ladder ran off the ask.

       On a green /99 autograph that produced PSA 7 $1, PSA 8 $1,
       PSA 9 $3, PSA 10 $7 -- multiplied out of a single $1 listing that
       was a sealed hobby box -- sitting directly under a panel saying
       there was not enough to call this one. Two refusals and a
       confident four-tier estimate on the same screen.

       No sales and a handful of asks is the WEAKEST evidence there is,
       not an exemption from the check. */
    /* Same typo, same consequence as the decision block above. */
    var ladderAskCount = Number((s && s.cnt) || (d.raw && d.raw.count) || 0);
    var ladderNoSold   = !(d.sold && d.sold.soldCount);

    var ladderUntrustworthy = !anyReal
      && (spreadFlagged || soldPoisoned || !!(d.sold && d.sold.soldLimited)
          || (ladderNoSold && ladderAskCount < THIN_RESULT_N));

    var roiHead;
    if(rows.inconsistent){
      roiHead = 'Graded prices — real data only';
    } else if(ladderSold && allReal){
      roiHead = 'What each grade actually SOLD for';
    } else if(anyReal){
      roiHead = 'What each grade is worth';
    } else {
      roiHead = 'If you graded it (rough estimate)';
    }

    if(ladderUntrustworthy){
      /* A REFUSAL THAT FIRES ON 57% OF SCANS IS NOT A REFUSAL, IT IS
         THE NORMAL STATE.

         Measured over 14 days: grade_ladder_refused fired on 137 of
         240 scans. Three cards in five got a paragraph explaining why
         there is no grade ladder -- to somebody who never asked for
         one. They asked what the card is worth.

         The writing is good and the reasoning is right. It answers a
         question the person did not pose, on a result screen already
         rendering six to fifteen elements per scan, above the thing
         they came for.

         So it collapses to one line, with the full explanation one tap
         away for the person who wants grades and finds none -- the
         only person it was ever for. The event still fires unchanged,
         so the 57% stays visible in the stats even though the
         paragraph no longer is. */
      var glId = 'gl-' + Math.random().toString(36).slice(2,8);
      html+='<div class="roi"><div class="roi-head" style="cursor:pointer" onclick="var e=document.getElementById(\''+glId+'\');if(e)e.style.display=(e.style.display===\'none\'?\'block\':\'none\');">'
        +'💎 No grade estimate for this one <span style="font-size:11px;opacity:.6">\u2014 why?</span></div>'
        +'<div class="roi-note" id="'+glId+'" style="display:none;color:var(--gold-warm)"><b>Not estimating grades on this one.</b> '
        + (ladderNoSold && ladderAskCount < THIN_RESULT_N
            ? 'There are no completed sales and almost nothing listed, so a grade estimate '
              + 'would be a multiple of a number we do not have. '
            : (d.sold && d.sold.soldLimited)
            ? 'There are too few clean sales of this exact card to build the estimate on, and '
              + 'a grade ladder off one or two sales is a guess wearing four decimal points. '
            : 'The sales behind the price describe more than one version of this card, so any '
              + 'grade estimate would be built on a number we have already said not to trust. ')
        +'Narrow the search below and the estimates come back.</div></div>';
      logEvent('grade_ladder_refused', String((d && d.cardName) || '').slice(0,120), false);
    } else {
    html+='<div class="roi"><div class="roi-head">💎 '+roiHead+'</div><div class="roi-grid">';
    rows.forEach(function(r){
      var sub = r.isReal ? (r.count+(ladderSold?' sold':' live'))
              : (r.value>0 ? (r.from ? 'est. from '+(rows.company||'PSA')+' '+r.from : GRADE_MULTS[r.grade]+'x est.') : 'no data');
      html+='<div class="roi-cell'+(r.isReal?' real':'')+'"><div class="roi-grade">'+esc(rows.company||'PSA')+' '+r.grade+'</div>'
        +'<div class="roi-val">'+(r.value>0?fmtMoney(r.value):'\u2014')+'</div>'
        +'<div class="roi-mult'+(r.isReal?' real':'')+'">'+sub+'</div></div>';
    });
    var roiNote;
    if(rows.inconsistent){
      roiNote = '<b style="color:var(--gold-warm)">These graded prices don\'t rise with the grade, '
        +'which usually means the search is matching more than one card.</b> '
        +'Only grades with real data are shown. Try narrowing the search below.';
    } else if(anyReal){
      roiNote = (ladderSold
        ? 'Green = real sold prices for this card. Grey = estimated from those sales.'
        : 'Green = real listings for this card right now. Grey = estimated from the real ones.')
        +' Grading ~$'+GRADE_COST+'. <b>Check sold comps before submitting.</b>';
    } else {
      roiNote = 'Estimated from asking price × typical grade multiples.'
        +' Grading ~$'+GRADE_COST+'. <b>Check sold comps before submitting.</b>';
    }
    html+='</div><div class="roi-note">'+roiNote+'</div></div>';
    }
  } else {
    html+='<div class="rnodata"><b>No listings found.</b><br/>Double-check the spelling, then try adding the year, brand &amp; grade.<br/><span class="rnodata-eg">Example: 2018 Topps Update Shohei Ohtani RC</span></div>';
  }

  /* Save sits directly under the numbers, before the feedback and the
     search box. It is the one action that carries the scan forward, and
     until now this page had nowhere to put a card it had just priced. */
  if(hasData){
    /* Stated before the button, not after the disappointment. */
    if(!currentUser){
      var anonCountNow = 0;
      try{ anonCountNow = parseInt(sessionStorage.getItem(ANON_SCAN_KEY) || '0', 10) || 0; }catch(e){}

      /* THE MILESTONE PROMPT — shown once, at the third anonymous scan.
         Never blocks the result above it. Logged once via
         signup_prompt_shown so we can measure what fraction of people
         who reach this point actually convert, before any real limit
         is ever imposed. */
      /* THE SCAN-3 MILESTONE PROMPT IS OFF. DELIBERATELY.

         It was the third separate account ask on one screen, and the
         worst-placed of them: it fired at the third scan, BEFORE
         anybody had kept a card. So it asked someone to protect
         something they did not have yet, and did it by displacing the
         save button they came for.

         Two asks remain, which is the whole set:
           1. The header -- "Log in" once cards exist, "Save cards
              free" before that. Navigation as much as an offer.
           2. The local prompt, AFTER cards are kept, where an account
              buys the one real thing: those cards surviving a cleared
              browser and showing up on another phone.

         The banner below now shows on every scan instead of being
         displaced at scan 3. Left as a disabled branch rather than
         deleted, so the panel and its copy are one edit away if the
         numbers say the ask is worth having back.

         signup_prompt_shown stops firing. Anything reading it is now
         measuring a prompt that is not shown. */
      if(false && anonCountNow === 3 && !anonPromptAlreadyShown()){
        markAnonPromptShown();
        logEvent('signup_prompt_shown', null, false);
        html+='<div style="margin:0;padding:20px 16px;background:linear-gradient(160deg,rgba(245,158,11,.14),rgba(17,24,39,.5));'
          +'border-top:1px solid rgba(245,158,11,.35);border-bottom:1px solid rgba(245,158,11,.35);text-align:center;">'
          +'<div style="font-family:var(--f);font-size:15px;font-weight:800;color:var(--text);line-height:1.4;margin-bottom:10px;max-width:32ch;margin-left:auto;margin-right:auto;">'
          /* THIS PANEL WAS SELLING THINGS THAT ARE ALREADY FREE.

             It said "create your free account TO KEEP SCANNING" and
             listed "Unlimited card scans" as a benefit -- directly
             above a button reading "Free and unlimited, no signup, no
             counter." Two panels touching each other, contradicting
             each other, on the screen where we ask for the sign-up.

             Four of the five bullets stopped being account benefits in
             the last two days: scanning was always uncapped, saving
             went local on 1 Sept, and watching values and price alerts
             now work from an email alone with no account at all.

             What an account actually buys, and the only things it
             buys: the cards survive a cleared browser, and they show
             up on another device. That is worth saying plainly. A list
             of five things where four are already yours reads as a
             pitch, and the moment somebody notices one is untrue they
             stop believing the other four. */
          +'Kept cards live in this browser only. An account is what makes them survive.</div>'
          +'<div style="text-align:left;max-width:290px;margin:0 auto 14px;font-size:12.5px;color:var(--text2);line-height:1.9;">'
          +'<div>\u2713 Your cards survive a cleared browser</div>'
          +'<div>\u2713 Open the same binder on another phone</div>'
          +'<div>\u2713 What you paid, and what you made on a sale</div>'
          +'<div style="color:var(--text3);margin-top:6px;">Scanning stays free and unlimited either way.</div>'
          +'</div>'
          +'<button onclick="openAuth()" style="background:var(--gold-warm);color:#1a1206;border:none;border-radius:10px;'
          +'padding:13px 26px;font-family:var(--f);font-weight:800;font-size:14px;cursor:pointer;">Create free account \u2192</button>'
          +'<div style="font-size:10.5px;color:var(--text3);margin-top:10px;">It\u2019s free. No credit card required.</div>'
        +'</div>';
      } else {
        html+='<div style="margin:0;padding:18px 16px;background:linear-gradient(160deg,rgba(34,197,94,.13),rgba(17,24,39,.5));'
          +'border-top:1px solid rgba(34,197,94,.32);border-bottom:1px solid rgba(34,197,94,.32);text-align:center;">'
          +'<div style="font-size:24px;margin-bottom:6px;">\ud83d\udd14</div>'
          +'<div style="font-family:var(--f);font-size:15px;font-weight:800;color:var(--text);line-height:1.35;margin-bottom:5px;">'
          /* THE CONDITION USED TO BE LOCAL_OK ALONE, AND IT IGNORED
             WHETHER THE PERSON WAS SIGNED IN.

             On any surface where storage is unavailable -- the Wix
             iframe, private mode, Safari after ITP clears it -- this
             button called openAuth() every single time, including for
             somebody who had ALREADY signed in seconds earlier. They
             sign in, scan another card, tap save, and are asked to sign
             in again. Nothing about being signed in was ever checked.

             A signed-in save does not need local storage at all: it
             writes to the account. So the question is "can this be
             kept anywhere" -- account OR device -- not "does
             localStorage work". */
          + (canKeep ? 'Keep this card' : 'Get an email when this card\u2019s price moves') + '</div>'
          +'<div style="font-size:12.5px;color:var(--text2);line-height:1.5;margin-bottom:13px;max-width:34ch;margin-left:auto;margin-right:auto;">'
          + (currentUser
              ? 'Saved to your account \u2014 on every device you sign in on, and we\u2019ll tell you when the price moves.'
              : LOCAL_OK
              ? 'Kept right here on this device. Add an email if you want it on another phone, or want us to tell you when the price moves.'
              : 'Save it free and we\u2019ll watch the price for you \u2014 no more checking back manually.') + '</div>'
          +'<button id="bannerSaveBtn" onclick="' + (canKeep ? 'saveToBinder(\'watching\')' : 'openAuth()') + '" style="background:var(--green);color:#052e16;border:none;border-radius:10px;'
          +'padding:13px 26px;font-family:var(--f);font-weight:800;font-size:14px;cursor:pointer;">'
          + (canKeep ? 'Keep this card \u2192' : 'Save &amp; watch this card \u2192') + '</button>'
          +'<div style="font-size:10.5px;color:var(--text3);margin-top:10px;">'
          + (currentUser ? 'Saved to your account'
              : LOCAL_OK ? 'Kept on this device'
                      : 'One email + a code, no password \u00b7 first 10 cards free') + '</div>'
        +'</div>';
      }
    }

    /* ONE SAVE ACTION, NOT TWO.

       This button and the bench's "Keep these N cards" were both
       green, the same size, about 200px apart, and did different
       things — one card versus the session. That is a choice nobody
       asked for, on a phone, at the moment we most want a yes.

       From the second lookup the bench is the save, so this steps
       aside rather than competing with it. On the first lookup there
       is no bench, so it stays: somebody who prices one card and wants
       to keep it should not have to look up a second one first. */
    if(bench.length < 2){
      var alreadySaved = !!savedKeys[String(d.cardName||'').toLowerCase()];
      /* FOUR PATHS, ONE UNDERLYING SAVE.
         Keep it and Watch it both call the same saveToBinder(status) —
         same insert, same free-limit check, same everything — just
         tagging status as 'own' or 'watching', a field the binder
         already reads and already lets someone change later. That's
         not two competing save actions, it's one action with two
         labeled doors into it, so the bug fixed earlier in this same
         block (two buttons offering the same thing at once) can't
         happen here — these two genuinely mean different things.
         Grade and Profit never touch the database at all; they're
         plain navigation, logged the same way the other two are so
         all four can be compared honestly. */
      html+='<div class="save-row next-actions">'
        +'<div class="na-label">What do you want to do with this card?</div>'
        +'<div class="na-grid">'
          +'<button class="na-btn na-save-btn" id="naKeepBtn" data-status="own" '
            +'onclick="nextAction(\'binder\',this)"'+(alreadySaved?' disabled':'')+'>'
            +'<span class="na-ic">\ud83d\udcda</span>'
            +'<span class="na-label-text">'+(alreadySaved ? 'Kept' : 'Keep it')+'</span>'
            +'<small class="na-sub">I own it</small>'
            +'</button>'
          +'<button class="na-btn na-save-btn" id="naWatchBtn" data-status="watching" '
            +'onclick="nextAction(\'watch\',this)"'+(alreadySaved?' disabled':'')+'>'
            +'<span class="na-ic">\ud83d\udcc8</span>'
            +'<span class="na-label-text">'+(alreadySaved ? 'Watching' : 'Watch it')+'</span>'
            +'<small class="na-sub">Tracking it</small>'
            +'</button>'
          +'<a class="na-btn" href="'+GRADE_TOOL_URL+'" target="_top" onclick="nextAction(\'grade\')">'
            +'<span class="na-ic">\ud83d\udd0e</span><span class="na-label-text">Grade it?</span></a>'
          +'<a class="na-btn" href="/profit-tracker.html" target="_top" onclick="nextAction(\'profit\')">'
            +'<span class="na-ic">\ud83d\udcb0</span><span class="na-label-text">Track profit</span>'
            +(!isPro?'<span class="na-pro">PRO</span>':'')+'</a>'
        +'</div>'
        +'</div>'
        +(currentUser && (bench.length || alreadySaved)
           ? '<a class="binder-link" href="'+BINDER_PAGE+'" target="_blank" rel="noopener"'
      + ' onclick="logEvent(\'open_binder_clicked\',\'saved\',false)">Open your binder \u2192</a>'
           : '')
        /* WHAT SAVING BUYS YOU, not what it costs.

           The old note said "the binder is the only part that needs a
           login", which describes a toll. Somebody who just got a
           price has no reason to make an account to store a number
           they can already see — the reason is what happens to the
           card afterwards, and nothing here said it. */
        +'<div class="save-note">'
        +(isPro
           ? 'Kept cards get re-priced every night. Your binder is unlimited.'
           : '<b>Kept cards get re-priced every night</b>, so you can see what moved. '
             +'First '+FREE_CARD_LIMIT+' are free.')
        +'</div>';
      /* Once per actual result, not once per render call — but "actual
         result" means once per NEW scan/search/refinement, not once
         per unique card name. The old version keyed this off card
         name, which meant scanning the same Ohtani three times only
         counted the panel as shown once — undercounting real exposure.
         Keying off the result OBJECT itself fixes that: a genuinely
         new lookup always produces a new object, so it always counts,
         while an auth-state repaint of the SAME result (renderResult
         called again on lastResult after signing in) reuses the same
         object and correctly doesn't count twice — that repaint isn't
         a new view, just the same one with a different save button. */
      if(nextActionShownFor !== d){
        nextActionShownFor = d;
        logEvent('next_action_shown', String(d.cardName||'Card').slice(0,200), false);
      }
    }
  }

  /* SCAN ANOTHER, OFFERED TO EVERYONE.

     The funnel says people who scan, scan 3.4 cards a session -- the
     loop works once somebody is in it. What was missing is the
     invitation: this page offered a second scan only after a save, and
     almost nobody saves. The standalone offered it nowhere at all.

     So the most common path by far -- scan, read the price, leave --
     was never asked to do the thing it was already inclined to do.

     Placed after the price and the save panel, because the answer is
     what they came for and it should not be interrupted. Clears both
     slots on the way so the next card is one tap, not three. */
  if(hasData){
    html+='<div class="scan-again">'
      +'<button class="scan-again-btn" onclick="scanAnother()">&#128247; Scan another card</button>'
      +'<div class="scan-again-sub">Scanning is free forever &mdash; unlimited with a free account.</div>'
    +'</div>';
  }

  /* WHAT TO DO WITH IT.

     Placed directly under the price and above Scan another, because
     the price is the question somebody arrived with and this is the
     answer they actually wanted. Everything below it -- feedback, the
     search box, the bench -- is housekeeping by comparison.

     Built only from what this scan already returned. The grading
     verdict is the same calculation renderCta has been running all
     along: the PSA 9 rung, not the 10, minus the fee. Nothing new is
     computed and nothing is estimated that was not already estimated.

     "Keep it" is deliberately absent. It needs a 90-day trend, and
     card_price_history only started accumulating under the current
     logic version yesterday. A trend line drawn through two days would
     be exactly the manufactured confidence the rest of this page
     refuses to produce. It comes back when the data is real. */
  html+=buildBackAsk(d);

  /* ===== SCAN FEEDBACK ===== */
  html+='<div class="fb" id="fbBox">'
    +'<div class="fb-q">Did we get this card right?</div>'
    +'<div class="fb-row">'
      +'<button class="fb-btn up" onclick="cgFeedback(\'up\')">&#128077; Yes</button>'
      +'<button class="fb-btn" onclick="cgFeedback(\'down\')">&#128078; No</button>'
    +'</div>'
    +'<div class="fb-sub">One tap. It tells us which cards the scanner gets wrong.</div>'
  +'</div>';

  /* ===== SEARCH-WE-RAN BOX =====
     Highlighted when the spread warning fired, since EDIT is the fix we
     just told them to use. */
  html+='<div class="sq'+(spreadFlagged?' flagged':'')+'">'
    +'<div class="sq-head">'
      +'<div class="sq-label">'+(d.corrected?'Your corrected search':"Here's the search we ran")+'</div>'
      +'<button class="sq-edit" id="sqEditBtn" onclick="sqEdit()">EDIT</button>'
    +'</div>'
    +'<div id="sqBody">'
      +'<div class="sq-text">'+esc(currentQuery)+'</div>'
      /* When the sold figure came from a broader query than the one
         above, say so HERE rather than leaving the panel to imply the
         displayed search produced the price. */
      +((d.soldQuery && String(d.soldQuery).trim()
            && String(d.soldQuery).trim() !== String(currentQuery).trim())
         ? '<div class="sq-broad">The sold price above did not come from this search \u2014 '
           + 'nothing had sold for it. It came from a wider one:'
           + '<div class="sq-text" style="margin-top:7px">' + esc(d.soldQuery) + '</div></div>'
         : '')
      +'<a class="sq-link" href="'+activeUrl+'" target="_blank" rel="noopener nofollow sponsored" onclick="affClick(\'open_search\');if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'open_search_on_ebay\',content_type:\'scanner_standalone\'})">↗ Open this exact search on eBay</a>'
      +'<div class="sq-why">'
        +(spreadFlagged
          ? 'The buttons above are the quick fix. For anything they don\'t cover — a specific parallel, a serial number, a set name — <b>tap EDIT</b> and type it in.'
          : ((d.soldQuery && String(d.soldQuery).trim()
                && String(d.soldQuery).trim() !== String(currentQuery).trim())
              ? 'Wrong card? Tap <b>EDIT</b> and we\'ll re-price it. We\'d rather you check our work.'
              : 'Every price above comes from this search. Wrong card? Tap <b>EDIT</b> and we\'ll re-price it. We\'d rather you check our work.'))
      +'</div>'
    +'</div>'
  +'</div>';

  html+='</div>';
  el.innerHTML=html;

  /* Mounted after the paint, because the panel needs its container to
     exist. Called on every render rather than once, so a re-price
     through the parallel chooser resets it -- a ceiling worked out for
     the base card must not survive onto the refractor. */
  try{
    if(window.BuyMaxPanel && document.getElementById('bmxMount')){
      BuyMaxPanel.mount('#bmxMount', {
        /* Not same-origin: this page is served from scan.cardgauge.com
           and the engine lives on the API host. */
        apiBase: API,
        card: {
          /* THE YEAR THE PRICE WAS ACTUALLY FOUND ON, NOT THE ONE ON
             SCREEN.

             The scan handler already does this: when a claimed year
             returns no sales it retries the current year, prices off
             whatever that finds, and reports the swap as yearGuess. The
             header keeps the model's read on purpose -- the card in
             somebody's hand is the authority and we do not silently
             rewrite it.

             But the panel was sending that displayed name back through
             the adapter, and the adapter calls getSoldComps directly --
             which does NOT contain the retry; that lives in the scan
             handler. So the panel re-asked a question the scanner had
             already answered, got the same zero the scanner discarded,
             and refused.

             Seen on a real card: the result showed $3 off 100 sales
             with a full PSA ladder, while BuyMax two inches below
             reported no usable comps at all. Two engines, same card,
             opposite answers, nothing on screen saying which to trust.

             Corrected here and nowhere else. The display is unchanged. */
          /* THE EXACT QUERY THE PRICE WAS FOUND WITH.

             getSoldComps caches by query string, and both the scanner
             and BuyMax's adapter call that same function. So an
             identical query returns the identical cached answer -- no
             second API call, and the two CANNOT disagree.

             They diverged because the strings differed. The scanner
             builds its query through tiers, retries a corrected year,
             broadens when a tier is thin, and reports whatever finally
             worked as soldQuery. The panel was reconstructing a query
             from the displayed fields instead -- a different string, a
             different cache key, a different answer. On a real card the
             result showed $3 off 100 sales while BuyMax two inches below
             said no usable comps at all.

             Echoing soldQuery back makes agreement structural rather
             than coincidental: there is one function, one cache, and one
             argument. cardName is the fallback for the rare response
             that carries no soldQuery. */
          name:        d.soldQuery || d.cardName || '',
          player:      d.player || '',
          year:        (d.yearGuess && d.yearGuess.triedYear) ? d.yearGuess.triedYear : (d.year || ''),
          brand:       d.brand || '',
          set:         d.set || '',
          card_number: d.cardNumber || '',
          parallel:    d.parallel || '',
          category:    'card',
          condition:   'raw'
        },
        onEvent: function(name, data){
          try{ logEvent(name, typeof data==='string' ? data : JSON.stringify(data||'').slice(0,120), false); }catch(e){}
        }
      });
    }
  }catch(e){}
  /* benchAdd() already ran above, before this HTML was built — so the
     single-save-button decision at line ~3762 and this render both saw
     the same, current bench state. Only the actual DOM paint for the
     bench still needs to happen here, now that the result's own markup
     is committed. */
  if(hasData){
    benchRender();
    /* The one-card prompt is what a single-lookup session sees, and
       most sessions are single-lookup. Counting it separately is what
       distinguishes "the bench offer is wrong" from "almost nobody
       ever reaches a bench". Uses the SAME bench.length the button
       above was built from — no more logging a different reality than
       what was actually shown. */
    if(bench.length < 2 && !saveOfferLogged){
      saveOfferLogged = true;
      logEvent('save_offer_shown', currentUser ? 'signed_in' : 'logged_out', false);
    }
  }
  renderLocalPrompt();
  renderCta(d, rows, s);
  setTimeout(function(){el.scrollIntoView({behavior:'smooth',block:'nearest'});},100);
  // Ask only after they've seen it work.
  if(hasData) maybeShowInstall();
}

/* ===== ADD TO HOME SCREEN =====
   The manifest and service worker have been sitting there installable with
   nothing ever telling anyone. Shown once, after a result — the moment the
   thing has just proved itself — and never again once dismissed or
   installed. Chrome/Android gets the real one-tap install; iOS Safari has
   no install API at all, so it gets the two-step instruction instead. */
var deferredInstall = null;
var installShown = false;
var INSTALL_KEY = 'cg_install_dismissed';

window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  deferredInstall = e;
});
window.addEventListener('appinstalled', function(){
  deferredInstall = null;
  rememberInstallDismissed();
  var c=document.getElementById('installCard');
  if(c) c.classList.remove('show');
});

function isStandalone(){
  try{
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }catch(e){ return false; }
}
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||'') && !window.MSStream;
}
function installDismissed(){
  try{ return localStorage.getItem(INSTALL_KEY) === '1'; }catch(e){ return false; }
}
function rememberInstallDismissed(){
  try{ localStorage.setItem(INSTALL_KEY,'1'); }catch(e){}
}

function maybeShowInstall(){
  if(installShown || isStandalone() || installDismissed()) return;
  var card = document.getElementById('installCard');
  if(!card) return;

  var body;
  if(deferredInstall){
    body = '<div class="install-row">'
      +'<button class="install-btn" onclick="doInstall()">Add CardGauge to my phone</button>'
      +'<button class="install-x" onclick="dismissInstall()">NOT NOW</button>'
    +'</div>';
  } else if(isIOS()){
    body = '<div class="install-steps">'
      +'1. Tap <span class="k">Share</span> at the bottom of Safari<br>'
      +'2. Choose <b>Add to Home Screen</b>'
      +'</div>'
      +'<div class="install-row" style="margin-top:14px">'
      +'<button class="install-x" onclick="dismissInstall()">GOT IT</button>'
      +'</div>';
  } else {
    return;   // desktop, or a browser that can't install — don't nag
  }

  card.innerHTML = '<div class="install-t">Price a card without opening a browser.</div>'
    +'<div class="install-s">Put the scanner on your home screen. Opens like an app, '
    +'works at the card show, still free.</div>'
    + body;
  card.classList.add('show');
  installShown = true;
  if(window.ttq) ttq.track('ViewContent',{content_name:'install_prompt',content_type:'scanner_standalone'});if(window.fbq)fbq('track','ViewContent',{content_name:'install_prompt',content_type:'scanner_standalone'});
}

async function doInstall(){
  if(!deferredInstall) return;
  if(window.ttq) ttq.track('ClickButton',{content_name:'install_accept',content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'install_accept',content_type:'scanner_standalone'});
  deferredInstall.prompt();
  try{ await deferredInstall.userChoice; }catch(e){}
  deferredInstall = null;
  var c=document.getElementById('installCard');
  if(c) c.classList.remove('show');
}

function dismissInstall(){
  rememberInstallDismissed();
  if(window.ttq) ttq.track('ClickButton',{content_name:'install_dismiss',content_type:'scanner_standalone'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'install_dismiss',content_type:'scanner_standalone'});
  var c=document.getElementById('installCard');
  if(c) c.classList.remove('show');
}

/* ===== ATTRIBUTION =====
   Pageviews don't answer the question that matters. Forty visitors from
   one channel who scan nothing are worth less than ten from another who
   scan three cards each, and no pageview tool can tell those apart. So
   the source is captured once on arrival and attached to every event.

   Sticky for the session: someone lands from a TikTok link, taps around,
   comes back via a bare URL — that's still the TikTok visit. Falls back
   to the referring host when there are no UTMs, so organic Google and
   Facebook links get counted without needing to be tagged.

   Nothing personal is stored: the session id is a random string that
   dies with the tab, and only the referrer's HOST is kept, never the
   full URL. */
var ATTR_KEY = 'cg_attr';

/* Pull UTM tags from a URL, whichever URL we can actually see. */
function utmFrom(href){
  try{
    var u = new URL(href, window.location.href);
    var p = u.searchParams;
    if(!p.get('utm_source')) return null;
    return {
      utm_source:   p.get('utm_source'),
      utm_medium:   p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign')
    };
  }catch(e){ return null; }
}

function readAttr(){
  /* THE IFRAME PROBLEM.

     On the Wix homepage this scanner runs inside an iframe, so
     window.location is the IFRAME's address — some filesusr URL — not
     the page somebody actually opened. A visit to
     cardgauge.com/?utm_source=youtube therefore recorded no tag at all,
     and the row landed as a self-referral from www.cardgauge.com.

     That is exactly what the events table showed, and it is also why
     tiktok_bio worked while youtube did not: the TikTok link points at
     scan.cardgauge.com, which is not embedded in anything.

     Inside an iframe, document.referrer IS the parent page's full URL,
     query string included. So: own URL first, then the parent's. */
  var fresh = utmFrom(window.location.href)
           || utmFrom(document.referrer || '')
           || { utm_source: null, utm_medium: null, utm_campaign: null };

  // No UTMs anywhere? Fall back to who linked here.
  if(!fresh.utm_source){
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch(e){}
    if(ref && ref.indexOf('cardgauge.com') === -1){
      fresh.utm_source = ref.replace(/^www\./, '');
      fresh.utm_medium = 'referral';
    }
  }

  // Stored attribution wins only if this visit brought nothing new.
  try{
    var saved = sessionStorage.getItem(ATTR_KEY);
    if(!fresh.utm_source && saved) return JSON.parse(saved);
    if(fresh.utm_source) sessionStorage.setItem(ATTR_KEY, JSON.stringify(fresh));
  }catch(e){}

  return fresh;
}

function attrSession(){
  try{
    var s = sessionStorage.getItem('cg_sid');
    if(!s){
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('cg_sid', s);
    }
    return s;
  }catch(e){ return ''; }
}

var CG_ATTR = null;

/* ===== IS THIS THE OWNER TESTING? =====
   scan_events carries no user id, and shouldn't — the scanner runs
   logged out for most people, so an id would be null on the majority
   of rows and useless for this.

   A flag is enough. Set it once on your own phone by opening any page
   with ?owner=1 on the end; it sticks in localStorage from then on.
   Every event after that is marked, and cg_stats filters them out.

   WHY IT MATTERS more than it sounds: the trust rate divides saves by
   lookups. Saves already exclude the owner because watchlist_items has
   a user id. Lookups did not. So a day spent testing pushed the
   denominator up while the numerator stayed put, and the one number
   the dashboard exists to measure was being dragged down by the work
   of building it.

   Deliberately NOT automatic. Guessing at "this looks like the
   developer" from a user agent or an IP would quietly drop real
   visitors, which is a worse failure than counting a few of your own
   scans. It only ever marks a device you marked on purpose. */
var CG_OWNER_KEY = 'cg_is_owner';

function cgIsOwner(){
  try{
    var p = new URLSearchParams(location.search);
    if(p.get('owner') === '1'){ localStorage.setItem(CG_OWNER_KEY,'1'); }
    if(p.get('owner') === '0'){ localStorage.removeItem(CG_OWNER_KEY); }
    return localStorage.getItem(CG_OWNER_KEY) === '1';
  }catch(e){ return false; }
}

function logEvent(event, cardName, usedBack){
  try{
    if(!CG_ATTR) CG_ATTR = readAttr();
    var refHost = '';
    try { refHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch(e){}
    fetch(SB_URL+'/rest/v1/rpc/log_scan_event',{
      method:'POST',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},
      body: JSON.stringify({
        p_event:         event,
        p_utm_source:    CG_ATTR.utm_source   || null,
        p_utm_medium:    CG_ATTR.utm_medium   || null,
        p_utm_campaign:  CG_ATTR.utm_campaign || null,
        p_referrer_host: refHost || null,
        p_card_name:     cardName ? String(cardName).slice(0,200) : null,
        p_used_back:     !!usedBack,
        p_session_id:    attrSession(),
        p_is_owner:      cgIsOwner()
      })
    }).catch(function(){});
  }catch(e){}
}

/* ============================================================
   ACCOUNTS AND SAVING

   This page priced a card and then had nowhere to put it. The bottom
   panel offered "Track it in My Binder", which was a bare link to another
   site — you arrived at an empty binder with the card you just scanned
   gone, and had to type it in by hand.

   That gap is worse here than anywhere else, because this is the phone
   version. Sending somebody to a different domain mid-flow loses them,
   and if the page is installed to a home screen the link can throw them
   out of the app entirely. So the account lives here now: sign in on this
   page, save on this page, never leave.

   Logged out, the button opens the sign-up box and REMEMBERS the card,
   then finishes the save once they're in. Nobody loses the scan they just
   did in order to create an account.
   ============================================================ */
/* binder.html has said 10 since this morning; this file still said 25.
   The same number living in two files is how the "25 FREE" copy survived
   a sweep that changed the cap everywhere else. */
const FREE_CARD_LIMIT = 10;
const BINDER_PAGE = '/binder.html';

var SB = null;
var currentUser = null, isPro = false;
var pendingSave = false, pendingSaveStatus = 'watching';
/* Set when somebody taps the bench save while logged out, so the
   whole session survives making an account. */
var pendingBench = false;
/* THE SIGN-UP THAT FORGETS YOU.

   This was a plain in-memory variable, and the funnel showed what that
   costs: 8 people started a sign-up in a week and 2 finished. Six did
   everything right and still ended up with nothing.

   The mechanism is the traffic. Most visits arrive from Facebook,
   Instagram and TikTok, which open links in their own in-app browser.
   Getting the code means leaving that browser, opening Mail, and coming
   back -- and coming back frequently reloads the page. The variable
   died with it, the modal closed, and the code in their hand had
   nowhere to go. verifyOtp would have been called with an empty email
   even if they had found their way back to the box.

   Persisted, and the code step is restored on load. Somebody who
   switches to their email app and returns lands exactly where they
   left off, with the address already filled in.

   sessionStorage rather than localStorage: it should survive an app
   switch, not sit around for a week after they gave up. */
var AUTH_PENDING_KEY = 'cg_auth_pending';
var authEmailPending = '';
try{ authEmailPending = sessionStorage.getItem(AUTH_PENDING_KEY) || ''; }catch(e){}
function setAuthPending(email){
  authEmailPending = email || '';
  try{
    if(email) sessionStorage.setItem(AUTH_PENDING_KEY, email);
    else sessionStorage.removeItem(AUTH_PENDING_KEY);
  }catch(e){}
}

/* Supabase is deferred, so it may not exist when this first runs. */

function sbReady(){
  if(SB) return SB;
  try{
    if(window.supabase && window.supabase.createClient){
      SB = window.supabase.createClient(SB_URL, SB_KEY);
    }
  }catch(e){ SB = null; }
  return SB;
}

/* THE BUG THIS FIXES.

   Supabase loads from a deferred <script>, so on a slow connection it
   can still be parsing when this first runs. The old version did
   `if(!sbReady()) return;` and never came back — auth silently never
   ran, currentUser stayed null for the entire session, and a signed-in
   Pro user saw "You're not signed in — this card won't be saved
   anywhere yet" sitting above a button that said "In your binder".

   Worse than the contradiction: every save in that session went through
   the logged-out path, so somebody with an account was being asked to
   make another one.

   It now retries until the library is there, and re-renders any result
   already on screen once it knows who the person is. */
var authRetries = 0;

async function checkAuthState(){
  if(!sbReady()){
    /* ~5s of retries. Past that the library is not coming — a blocked
       CDN or an offline phone — and scanning still works without it. */
    if(authRetries++ < 25){ setTimeout(checkAuthState, 200); }
    else console.warn('[auth] Supabase never loaded; running signed-out');
    return;
  }
  var before = currentUser ? currentUser.id : null;
  try{
    var r = await SB.auth.getSession();
    currentUser = r.data.session ? r.data.session.user : null;
  }catch(e){ currentUser = null; }

  if(currentUser) await checkPro();
  renderAuth();

  /* A result rendered before auth resolved is showing the wrong save
     state. Re-render it rather than leaving a signed-in person looking
     at a signed-out prompt. Guarded on an actual change so this cannot
     loop. */
  var after = currentUser ? currentUser.id : null;
  if(before !== after && lastResult){
    try{ renderResult(lastResult); }catch(e){}
  }
}

/* STILL FAILS OPEN, BUT NO LONGER ON THE FIRST DROPPED REQUEST.

   The reasoning for failing open is right and is kept: telling somebody
   who pays that their binder is full is a worse outcome than granting a
   session too much. What was wrong is that it LATCHED. One failed call
   set isPro = true for the rest of the session, with no retry and no
   way to tell a real subscriber from a network blip.

   Every observed failure has been exactly that blip. Both recorded
   pro_check_failed events came from ONE session on 4 Sept, 54 seconds
   apart, both reading 'TypeError: Load failed' -- Safari's message for
   a request that never completed. A single retry would have caught
   both, and neither person would have been granted anything.

   So: retry once, briefly, before deciding. Only a second failure
   falls open, and when it does the grant is marked provisional so the
   next call re-checks instead of trusting a cached guess. A stale true
   costs a few saves; a stale true that never re-examines itself is a
   subscription nobody is paying for. */
var proProvisional = false;

async function checkPro(){
  if(!sbReady() || !currentUser){ isPro = false; proProvisional = false; return false; }

  var lastErr = null;
  for(var attempt = 0; attempt < 2; attempt++){
    try{
      var r = await SB.rpc('is_pro');
      if(r.error) throw r.error;
      isPro = r.data === true;
      proProvisional = false;   /* a real answer clears any earlier guess */
      return isPro;
    }catch(e){
      lastErr = e;
      /* Short and only once. This runs while somebody is waiting to save
         a card, so a long backoff would be its own bad outcome. */
      if(attempt === 0) await new Promise(function(res){ setTimeout(res, 600); });
    }
  }

  var msg = (lastErr && lastErr.message ? lastErr.message : 'unknown');
  console.warn('[pro] check failed twice, allowing provisionally:', msg);
  logEvent('pro_check_failed', ('retried: ' + msg).slice(0,120));
  isPro = true;
  proProvisional = true;
  return isPro;
}

/* SELLING PRO TO SOMEBODY WHO ALREADY BOUGHT IT.

   The pricing card renders from static markup and nothing ever looked
   at isPro, so an account with the gold PRO badge in the header scrolled
   down to "Get Pro — $12.99/mo" underneath it. Two statements about the
   same account, on one screen, contradicting each other. It reads as
   broken, and it is the screen a dealer gets handed at a table.

   The section stays rather than being hidden. The feature list is what
   Pro actually is, and a subscriber has reason to read it -- what goes
   is the price, the billing toggle and the buy button, which are the
   only parts that stop making sense once somebody is paying.

   Gated on (isPro && !proProvisional), the same condition the PRO badge
   uses, and for the same reason. After two failed checks the code fails
   open and guesses Pro so saves are not blocked; acting on that guess
   here would hide the price from somebody who is not a subscriber and
   quietly cost a sale. A guess is enough to allow a save. It is not
   enough to stop selling. */
function renderProSection(){
  var card = document.querySelector('.pro-card');
  if(!card) return;
  var on = !!(isPro && !proProvisional);

  var toggle = card.querySelector('.pro-toggle');
  var price  = card.querySelector('.pro-price');
  var intro  = document.getElementById('proIntro');
  var cta    = document.getElementById('proCtaBtn');

  if(toggle) toggle.style.display = on ? 'none' : '';
  if(price)  price.style.display  = on ? 'none' : '';
  if(cta)    cta.style.display    = on ? 'none' : '';
  if(intro){
    intro.textContent = on
      ? '\u2713 You\'re on Pro \u2014 everything below is already switched on.'
      : '\u25c6 Cancel anytime \u2014 no contract';
    intro.style.color = on ? 'var(--green)' : '';
  }
}

function renderAuth(){
  var w = document.getElementById('tbAuth');
  if(!w) return;
  if(currentUser){
    /* A SIGNED-IN PERSON HAD NO WAY TO REACH THEIR OWN BINDER.

       The header read "Hi, name · PRO · Log Out" and nothing else. On a
       phone the only route to the binder was scrolling past the entire
       result to a link at the bottom, and on the Wix site the nav is
       behind a hamburger. Somebody who kept a card had to hunt for the
       place it went.

       That is very likely part of why local_binder_merged sat at zero
       for weeks: not people refusing to open the binder, but never
       finding it. Log Out was more prominent than the product.

       One link, not a nav. The binder is the only destination that
       matters from here -- Profit Tracker, Portfolio and Set Builder
       all hang off it, and a row of six links in a header is how the
       camera gets pushed off the screen on the surface whose whole
       point is speed. */
    w.innerHTML = '<a class="tb-binder" href="' + BINDER_PAGE + '" target="_blank" '
      + 'rel="noopener" onclick="logEvent(\'open_binder_clicked\',\'header\',false)">'
      + 'My Binder</a>'
      + '<span class="tb-who">Hi, <b>'+esc(currentUser.email.split('@')[0])+'</b></span>'
      /* Not shown while the grant is provisional. A PRO badge is a
         claim about somebody's account, and after two failed checks we
         do not know whether it is true -- so the saves are allowed and
         the badge stays off rather than telling a free user they are a
         subscriber. */
      + ((isPro && !proProvisional) ? '<span class="tb-pro">PRO</span>' : '')
      + '<button class="tb-auth" onclick="logOut()">Log Out</button>';
    renderProSection();
  } else {
    /* THE FOURTH ASK ON THE SAME SCREEN.

       Counted 2 Sept: somebody signed out who has ALREADY kept a card
       locally sees the account ask here, on the save button, on the
       bench, and in the panel at the bottom. Four times, for a question
       they answered by keeping cards without one.

       "Save cards free" is aimed at somebody who has saved nothing --
       it is a reason to sign up. Once there are cards on the device it
       is answering a question already settled, so it becomes "Log in",
       which is what somebody at that point might actually want: getting
       BACK to an account they already have, on another phone.

       Deliberately not hidden. A returning user with local cards still
       needs a way in, and removing the only door is worse than
       repeating an offer. */
    /* "SAVE CARDS FREE" WAS ADVERTISING SOMETHING ALREADY GIVEN AWAY.

       It reads as "sign up and you can save cards for nothing" -- but
       saving has needed no account since 1 Sept. So the header was
       selling, as the reason to make an account, the exact thing the
       page hands over without one. Anybody who noticed would rightly
       wonder what else was overstated.

       One label in both states. "Sign in" covers coming back to an
       account and making a first one, and it is navigation rather than
       a pitch -- which is all the header should be now that the real
       ask lives in one place after the price.

       The free-ness that IS true stays as the line beside it: scanning
       costs nothing and never will. */
    /* THE BUTTON HAS TO CARRY THE REASON, BECAUSE ON A PHONE IT IS THE
       ONLY THING THERE.

       .tb-free is hidden below 560px. So on mobile -- which is nearly
       all the traffic -- "Scanning is free" never renders and the
       header was a bare "Sign in": a door with nothing written on it.

       Of the three things an account actually buys, two are insurance
       (the cards survive a cleared browser, and they open on another
       phone) and people do not act on insurance. The third is a reason
       to come BACK: kept cards get re-priced every night, so you can
       see what moved. That is the one worth the four words there is
       room for.

       "Track my cards" says it without claiming a feature that does
       not exist. Not "sign in for more" -- that is the vague shape
       stripped out of three other places today. */
    w.innerHTML = '<span class="tb-free">Scanning is free</span>'
      + '<button class="tb-auth" onclick="openAuth()">Track my collection</button>';
  }
}

/* ===== EMAIL-CODE AUTH (no password) =====
   A password is a second decision on top of "give this site my email",
   and it's the decision that was killing conversion — 2-3% of lookups
   ever turned into a saved card. This replaces signUp/signInWithPassword
   with Supabase's OTP flow: one email field, one 6-digit code field,
   nothing to create or remember.

   REQUIRES: Supabase Dashboard -> Authentication -> Email Templates ->
   Magic Link template must include {{ .Token }} so the email actually
   contains a 6-digit code, not just a link. Supabase's default template
   is link-only. */
function openAuth(){
  var m=document.getElementById('authModal'); if(m) m.classList.add('show');
  var e=document.getElementById('authErr'); if(e) e.classList.remove('show');
  backToEmailStep();
  var f=document.getElementById('authEmail'); if(f) f.focus();
  logEvent('signup_started', null, false);
}
function closeAuth(){
  var m=document.getElementById('authModal'); if(m) m.classList.remove('show');
  pendingSave = false;
  pendingBench = false;
}
function backToEmailStep(){
  var se=document.getElementById('authStepEmail'); if(se) se.style.display='';
  var sc=document.getElementById('authStepCode'); if(sc) sc.style.display='none';
  var e=document.getElementById('authErr'); if(e) e.classList.remove('show');
}

async function sendAuthCode(isResend){
  if(!sbReady()){ toast('Accounts unavailable right now \u2014 scanning still works'); return; }
  var email=(document.getElementById('authEmail').value||'').trim();
  var err=document.getElementById('authErr');
  err.classList.remove('show');
  if(!email || email.indexOf('@') < 0){ err.textContent='Enter a valid email.'; err.classList.add('show'); return; }

  var btn=document.getElementById('authSubmit'), orig=btn.textContent;
  btn.disabled=true; btn.textContent='Sending\u2026';
  try{
    var r = await SB.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    if(r.error) throw r.error;
    setAuthPending(email);
    var shown=document.getElementById('authEmailShown'); if(shown) shown.textContent = email;
    var se=document.getElementById('authStepEmail'); if(se) se.style.display='none';
    var sc=document.getElementById('authStepCode'); if(sc) sc.style.display='';
    var cf=document.getElementById('authCode'); if(cf) cf.focus();
    /* THE MIDDLE STEP OF THE SIGNUP FUNNEL WAS INVISIBLE.

       binder.html logs binder_auth_code_sent immediately after the
       same signInWithOtp call. This file never did -- so a code sent
       from the SCANNER, which is where the account wall lives and
       where nearly every signup begins, recorded nothing at all.

       The cost was a funnel that read as broken. 43 people fired
       signup_started and the dashboard showed 5 codes sent, because
       those 5 were the only ones who happened to sign up from the
       binder page instead. Anyone reading it would conclude the code
       step was failing, when what was failing was the measurement.

       Same event name as the binder deliberately, so the stats
       function counts both surfaces without a second branch. Same
       class of bug as the missing card_saved found this morning: an
       event that exists in one copy of a duplicated file and not the
       other. */
    logEvent('binder_auth_code_sent', isResend ? 'resend' : null, false);
    if(isResend) toast('Code resent');
  }catch(e){
    err.textContent = e.message || 'Could not send code \u2014 try again.';
    err.classList.add('show');
  }
  btn.disabled=false; btn.textContent=orig;
}

async function verifyAuthCode(){
  if(!sbReady()) return;
  var code=(document.getElementById('authCode').value||'').trim();
  var err=document.getElementById('authErr');
  err.classList.remove('show');
  if(!code){ err.textContent='Enter the code from your email.'; err.classList.add('show'); return; }

  var btn=document.getElementById('authVerifyBtn'), orig=btn.textContent;
  btn.disabled=true; btn.textContent='Checking\u2026';
  try{
    var r = await SB.auth.verifyOtp({ email: authEmailPending, token: code, type: 'email' });
    if(r.error) throw r.error;
    currentUser = r.data.user || (r.data.session && r.data.session.user);
    clearFreeScanCount();
    if(!currentUser) throw new Error('Something went wrong \u2014 try again.');
    setAuthPending('');
    await checkPro();
    /* BRING THE LOCAL CARDS WITH THEM.

       Without this, somebody who kept five cards on the device and then
       created an account would land on an empty binder while those five
       sat orphaned in the browser. That is worse than the wall it
       replaces: the wall never promised anything, whereas this would
       look like signing up destroyed their collection.

       Runs before the pending save so the counts are right, skips
       anything already in the account by name, and only clears the
       local copy once every row is confirmed written. A partial merge
       keeps the local set intact and tries again next time. */
    try{ await mergeLocalBinder(); }catch(e){ console.warn('[merge] failed:', e.message); }

    var wanted = pendingSave, wantedBench = pendingBench;
    closeAuth(); renderAuth();
    /* The last step of the funnel, and it was as blind as the one
       before it. binder_auth_verified fired only from binder.html, so
       an account created at the scanner -- which is where the wall
       sends people -- was never recorded as a completion.

       That is why the dashboard read 7 verified against 43 signups
       started. Not a broken signup: an unlogged one. Same event name
       as the binder so both surfaces roll into one funnel. */
    logEvent('binder_auth_verified', null, false);
    toast('\u2705 You\'re in');
    logEvent('signup_completed', null, false);
    /* THE CONVERSION. Somebody gave an email, waited for a code, typed
       it in and now has an account. This is the only event on the site
       that meets Meta's definition of a lead, and until now it was the
       one event the pixel never heard about. Optimise campaigns
       against CompleteRegistration, not Lead. */
    try{ if(window.fbq) fbq('track','CompleteRegistration',{content_name:'account_created',status:true}); }catch(e){}
    try{ if(window.ttq) ttq.track('CompleteRegistration',{content_name:'account_created'}); }catch(e){}
    /* Repaint the result first. Signing in changes the save prompt, the
       "not signed in" warning and the bench CTA, and leaving those
       stale is how a signed-in user ends up reading "this card won't be
       saved anywhere yet" directly above a card that just saved. */
    try{ renderLocalPrompt(); }catch(e){}
    if(lastResult){ try{ renderResult(lastResult); }catch(e){} }
    if(wantedBench){ pendingBench = false; benchSaveAll(); }
    else if(wanted) saveToBinder(pendingSaveStatus);   // finish what they were trying to do, with the status they'd picked
    else {
      /* THEY DID NOT COME HERE TO SAVE ANYTHING, AND THAT IS THE
         COMMON CASE.

         pendingSave and pendingBench are only set when somebody TAPS a
         save button. The other route into this handler is the scan
         wall -- three free scans used, account_wall, openAuth -- and it
         sets neither. So the person who has just given an email,
         waited for a code and typed it in gets "You're in" and then
         nothing at all.

         Measured over four days: free_scans_exhausted and account_wall
         fire in the SAME 8 sessions. 9 people verified an account. Two
         cards were saved in seven days. They are not signing up to keep
         cards; they are signing up to keep scanning, and at the one
         moment they have an account and a bench full of cards they just
         looked at, nobody asks.

         The bench already holds them -- benchAdd() runs on every scan
         with data and stores up to 40 in sessionStorage, which survives
         the email round trip as long as the tab stays open. Nothing
         needs building to know what they scanned. It only needs
         offering.

         Deliberately an offer, not an action. Saving three cards
         somebody never asked to save, seconds after they handed over an
         email, is the kind of helpfulness that reads as presumption.
         The bench is scrolled to and its button pulsed once; the tap
         stays theirs. */
      try{
        var unsaved = bench.filter(function(b){ return !b.saved; }).length;
        if(unsaved > 0){
          renderResult && lastResult && renderResult(lastResult);
          setTimeout(function(){
            var box = document.getElementById('benchBox');
            var btn = document.getElementById('benchBtn');
            if(!box) return;
            box.scrollIntoView({ behavior:'smooth', block:'center' });
            if(btn){
              btn.classList.add('bench-btn-nudge');
              setTimeout(function(){ btn.classList.remove('bench-btn-nudge'); }, 2600);
            }
            toast('\u2705 You\'re in \u2014 keep the ' + unsaved + ' card' +
                  (unsaved===1?'':'s') + ' you just looked at?');
            logEvent('bench_offered_after_signup', String(unsaved), false);
          }, 420);
        }
      }catch(e){}
    }
  }catch(e){
    err.textContent = e.message || 'That code didn\'t work \u2014 check it and try again.';
    err.classList.add('show');
  }
  btn.disabled=false; btn.textContent=orig;
}

async function logOut(){
  if(sbReady()) await SB.auth.signOut();
  currentUser=null; isPro=false; proProvisional=false; renderAuth(); toast('Logged out');
}

function toast(msg){
  document.querySelectorAll('.toast').forEach(function(t){t.remove();});
  var t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(function(){t.remove();},2600);
}

/* The free cap counts WATCHED cards only, matching my-binder.html.
   Counting every row would mean somebody who logged 25 purchases at a
   show came home to a "binder full" wall for recording what they bought. */
async function watchedCount(){
  if(!sbReady() || !currentUser) return 0;
  try{
    var r = await SB.from('watchlist_items')
      .select('id', { count:'exact', head:true })
      .eq('user_id', currentUser.id)
      .is('buy_price', null);
    return r.count || 0;
  }catch(e){ return 0; }
}

/* Dispatch for the four-path panel. Keep/Watch route through the one
   real save function below with a status flag; Grade/Profit are plain
   navigation (the href does the actual work), so this only needs to
   log which door somebody chose — never preventDefault, never block
   the link. */
function nextAction(type, btnEl){
  if(type==='binder'){
    logEvent('next_action_binder', lastResult ? lastResult.cardName : null, false);
    saveToBinder('own', btnEl);
  } else if(type==='watch'){
    logEvent('next_action_watch', lastResult ? lastResult.cardName : null, false);
    saveToBinder('watching', btnEl);
  } else if(type==='grade'){
    logEvent('next_action_grade', lastResult ? lastResult.cardName : null, false);
  } else if(type==='profit'){
    logEvent('next_action_profit', lastResult ? lastResult.cardName : null, false);
  }
}

/* ── SAVING WITHOUT AN ACCOUNT ──────────────────────────────────

   The measured leak: 166 sessions were offered a save, 21 started a
   sign-up, 5 finished, 2 ended up with a card. Both save paths opened
   with `if(!currentUser){ openAuth(); return; }` -- a hard wall in
   front of the only thing that makes somebody come back.

   The page promises "no signup, no limit" and then asks for an account
   at the exact moment value has already been delivered. At that point
   an account is pure cost to the person and pure benefit to us, which
   is a bad trade to ask for and 87% of people declined it.

   So the card is kept first, on the device, immediately. The account
   ask moves to where it is genuinely worth something: keeping the
   collection when the phone changes, and getting told when a price
   moves. Neither is possible locally, so neither is a fake reason.

   THE HONEST LIMIT, STATED EVERYWHERE IT MATTERS: a local save lives
   in this browser. Clearing site data loses it, and it does not appear
   on another device. Quietly implying permanence would be worse than
   the wall it replaces -- somebody losing a catalogued collection
   trusts nothing afterwards. Every surface says "saved on this
   device". */
const LOCAL_BINDER_KEY = 'cg_local_binder';

/* ── THREE FREE SCANS, THEN AN ACCOUNT ──────────────────────────

   The bet: a scan answers its own question and ends, so an account
   asked for at scan one is pure cost. By scan three the person has
   chosen to come back twice and the tool has proved itself, which is
   the first moment an account is a step forward rather than a toll.

   WHY THREE AND NOT ONE. The measured history is not encouraging for
   walls here: 166 sessions were offered a save, 21 started a sign-up,
   5 finished, 2 ended with a card -- and that ask came AFTER value was
   delivered. A wall at scan one would meet cold social traffic that
   arrived ten seconds earlier. Three keeps the part of the funnel that
   currently works and still asks everyone who shows real intent.

   FAILS OPEN, ALWAYS. This scanner runs in a Wix iframe on a
   filesusr.com origin, where storage is third-party: Safari and Chrome
   partition or block it, and ITP clears it after seven days idle.
   LOCAL_OK already probes for that. When storage is unavailable the
   count cannot be trusted, so nobody is blocked -- losing a signup
   costs far less than refusing somebody their first scan because we
   could not count. On the Wix surface the limit is therefore leaky and
   resets periodically; on the standalone PWA it is solid. That is a
   real difference in enforcement and it is deliberate. */

var SCAN_FREE_LIMIT = 3;
var SCAN_COUNT_KEY  = 'cg_free_scans';
var SCAN_COUNT_AT   = 'cg_free_scans_at';
/* How long a used-up allowance takes to come back. */
var FREE_SCAN_RESET_DAYS = 30;

/* THREE SCANS WAS THREE PER BROWSER, FOR EVER.

   The counter went up and never came down. Somebody who tried
   CardGauge once, scanned three cards and left came back a week later
   and was shown a signup wall on their first tap -- having received
   nothing at all that visit.

   That is most of the "closed it and left" group. Read from the events
   on 8 Sept: a visitor arrived from Google, loaded the scanner, pressed
   Scan and hit the wall ten seconds later with zero lookups. Same shape
   for five other sessions. They were not refusing an account after
   getting value; they never got any.

   The allowance now renews every 30 days. A returning visitor gets
   three more scans, which is the whole argument for the free tier: the
   product proves itself first. Somebody scanning hundreds of cards a
   month still hits the wall, which is who it is for.

   The window is stored beside the count rather than derived from a
   calendar month, so it is a rolling 30 days from first use rather
   than everybody resetting on the 1st. */
function freeScansUsed(){
  if(!LOCAL_OK) return 0;
  try{
    var started = parseInt(localStorage.getItem(SCAN_COUNT_AT) || '0', 10) || 0;
    if(started && (Date.now() - started) > FREE_SCAN_RESET_DAYS * 86400000){
      /* Window expired. Clear both so the next scan starts a new one. */
      localStorage.removeItem(SCAN_COUNT_KEY);
      localStorage.removeItem(SCAN_COUNT_AT);
      try{ logEvent('free_scans_renewed', null, false); }catch(e){}
      return 0;
    }
    return parseInt(localStorage.getItem(SCAN_COUNT_KEY) || '0', 10) || 0;
  }catch(e){ return 0; }
}

/* Counted only for signed-out people, and only on a scan that actually
   returned a card. A failed scan is not a free one. */
function noteFreeScan(){
  if(currentUser || !LOCAL_OK || cgIsOwner()) return;
  try{
    var n = freeScansUsed() + 1;
    localStorage.setItem(SCAN_COUNT_KEY, String(n));
    /* Stamped on the FIRST scan of a window and left alone after, so
       the 30 days run from when they started rather than sliding
       forward with every scan -- which would mean somebody scanning
       regularly never renews at all. */
    if(!localStorage.getItem(SCAN_COUNT_AT)){
      localStorage.setItem(SCAN_COUNT_AT, String(Date.now()));
    }
    if(n === SCAN_FREE_LIMIT) logEvent('free_scans_exhausted', String(n), false);
  }catch(e){}
}

/* OWNER BYPASS. Not security -- this is a string in frontend
   JavaScript and anyone can read it, the same way anyone can already
   clear localStorage and get three more scans. The wall is a funnel
   step, not a lock, so a convenience switch is the right weight.

   Reuses cgIsOwner(), which was already here for keeping Sebastian's
   own scans out of the analytics. Set it once per surface with
   ?owner=1 on the URL and it persists; ?owner=0 clears it.

   Owner scans also stop counting toward the limit below, which matters
   for more than convenience: without it, every test scan inflates
   free_scans_exhausted and account_wall, and the scan-3-to-account
   number -- the whole reason the wall exists -- would be measuring
   Sebastian instead of visitors. */
function needsAccount(){
  if(cgIsOwner()) return false;
  return !currentUser && LOCAL_OK && freeScansUsed() >= SCAN_FREE_LIMIT;
}

/* NOT A PUNISHMENT SCREEN. No counter, no "you have used up", no red.
   It names what an account is for and what it costs -- one field, a
   code, no password -- because the round trip to an email app is what
   actually loses people, not the idea of an account. */
/* How many times this person has closed the wall in this session.

   Deliberately not persisted. A returning visitor tomorrow gets asked
   again, which is fair -- this only stops the app nagging inside one
   sitting. */
var wallDismissCount = 0;
var WALL_MAX_ASKS = 3;

/* THE MOMENT SOMEBODY WOULD PAY, SPENT ON A TOAST AND A NEW TAB.

   binder.html has had a proper Pro wall since it was built --
   showProWall() renders it and logs pro_wall with a reason. This file
   has never had either. Both cap paths here showed "Free binder is
   full" and opened the binder in another tab.

   So the pro_wall event has never fired once in the app's life, and
   the dashboard's Pro funnel reads 0 at the step where money is made.
   A real user saved exactly 10 cards on 23 August, hit this, and never
   came back. They were never shown a price.

   Fourth instance of the same bug in two days: something built in one
   copy of a duplicated file and missing from the other. card_saved,
   binder_auth_code_sent, binder_auth_verified, and now this.

   Deliberately says what they GET rather than what they have hit. "You
   have reached your limit" describes our rule; "your binder is full,
   Pro takes the cap off" describes their situation and what fixes it. */
function showProWall(why){
  try{ logEvent('pro_wall', why || 'unknown', false); }catch(e){}
  /* Reuses the account wall's host and classes rather than inventing
     a second set. Created on demand exactly as that one does, so this
     works whether or not the account wall has ever been shown. */
  var el = document.getElementById('cgWall');
  if(!el){
    el = document.createElement('div');
    el.id = 'cgWall';
    document.body.appendChild(el);
  }
  if(window.ttq) ttq.track('ViewContent',{content_name:'pro_wall',content_type:'scanner'});
  if(window.fbq) fbq('track','ViewContent',{content_name:'pro_wall',content_type:'scanner'});

  el.innerHTML =
    '<div class="cgw-ov" onclick="if(event.target===this)closeProWall()">'
  +   '<div class="cgw">'
  +     '<button class="cgw-x" onclick="closeProWall()">&times;</button>'
  +     '<div class="cgw-h">Your binder is full</div>'
  +     '<div class="cgw-p">All ' + FREE_CARD_LIMIT + ' free cards are saved. Pro takes '
  +       'the cap off and keeps repricing everything you own, every night.</div>'
  +     '<ul class="cgw-list">'
  +       '<li><span>\u2713</span>Unlimited cards in your binder</li>'
  +       '<li><span>\u2713</span>Every card repriced overnight from real sales</li>'
  +       '<li><span>\u2713</span>What you paid against what it\u2019s worth now</li>'
  +       '<li><span>\u2713</span>Finish your sets without a spreadsheet</li>'
  +     '</ul>'
  +     '<button class="cgw-cta" onclick="proFromWall(\'' + (why||'unknown') + '\')">'
  +       'GO PRO \u2014 ' + PRO_PRICE + '/MO</button>'
  +     '<div class="cgw-alt">'
  +       '<a onclick="closeProWall(); window.open(BINDER_PAGE,\'_blank\',\'noopener\');">'
  +       'Open my binder and clear a slot</a></div>'
  +   '</div>'
  + '</div>';
}

function closeProWall(){
  var el = document.getElementById('cgWall');
  if(el) el.innerHTML = '';
  logEvent('pro_wall_dismissed', null, false);
}

/* Separated from the wall so a click is never counted as a dismissal
   -- the same mistake the account wall made and had to be fixed for. */
function proFromWall(why){
  logEvent('pro_wall_clicked', why || 'unknown', false);
  if(window.ttq) ttq.track('Subscribe',{content_name:'cardgauge_pro',content_type:'pro_wall'});
  if(window.fbq) fbq('track','InitiateCheckout',{content_name:'cardgauge_pro'});
  var el = document.getElementById('cgWall');
  if(el) el.innerHTML = '';
  window.open(proUrl(), '_blank', 'noopener');
}

function showAccountWall(){
  /* ASKING SOMEBODY ELEVEN TIMES IS NOT A FUNNEL.

     Measured over the wall's first three days: 46 showings across 12
     people. One person saw it ELEVEN times and closed it eleven times;
     another ten and ten. They hit three scans, closed the wall, tried
     another scan, and got it again -- every time, for as long as they
     kept going.

     Somebody who has closed this three times has answered the question.
     Continuing to ask is what makes an app feel like it is nagging, and
     it costs nothing to stop: they were not converting anyway. The scan
     is still blocked, they simply are not shouted at about it again.

     Logged so the difference is visible in the data rather than looking
     like the wall stopped working. */
  if(wallDismissCount >= WALL_MAX_ASKS){
    logEvent('account_wall_suppressed', String(wallDismissCount), false);
    /* Names the actual button. The header control says "Track my
       collection", not "Sign in", so telling somebody to look for a
       link in the header sends them hunting for words that are not on
       the screen.

       Deliberately does NOT list features here. The wall they just
       closed three times already listed them; repeating that in a bar
       which disappears in four seconds is the same nagging in smaller
       type. This exists to stop pestering somebody while leaving the
       door visible, not to make one more pitch. */
    toast('Tap \u201cTrack my collection\u201d up top whenever you want to carry on');
    return;
  }
  logEvent('account_wall', String(freeScansUsed()), false);
  if(window.ttq) ttq.track('ViewContent',{content_name:'account_wall',content_type:'scanner'});if(window.fbq)fbq('track','ViewContent',{content_name:'account_wall',content_type:'scanner'});

  var el = document.getElementById('cgWall');
  if(!el){
    el = document.createElement('div');
    el.id = 'cgWall';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div class="cgw-ov" onclick="if(event.target===this)closeAccountWall()">'
  +   '<div class="cgw">'
  +     '<button class="cgw-x" onclick="closeAccountWall()">&times;</button>'
  +     '<div class="cgw-h">Keep scanning \u2014 free</div>'
  /* LEAD WITH WHAT THEY WERE DOING, NOT WITH THE ACCOUNT.

     "Create your free CardGauge account" describes the thing WE want.
     This person was scanning cards and got stopped; what they want is
     to carry on. The account is how, not why.

     The feature list moved the same way. "Collection tools" and "Price
     tracking" are category names -- true, and they tell somebody who has
     never used the app nothing. Each line now says what it does. */
  +     '<div class="cgw-p">You\'ve used your three free scans. An account gives you '
  +       'unlimited scanning and somewhere to keep what you find.'
  +       '<br><b>No password \u2014 just an emailed code.</b></div>'
  +     '<ul class="cgw-list">'
  +       '<li><span>\u2713</span>Scan as many cards as you like</li>'
  +       '<li><span>\u2713</span>A binder that remembers what you own</li>'
  +       '<li><span>\u2713</span>An email when one of your cards moves in price</li>'
  +       '<li><span>\u2713</span>See which cards a set is still missing</li>'
  +     '</ul>'
  +     '<button class="cgw-cta" onclick="wallToAuth()">CREATE FREE ACCOUNT</button>'
  +     '<div class="cgw-alt">Already have an account? '
  +       '<a onclick="wallToAuth()">Log in</a></div>'
  +   '</div>'
  + '</div>';
}

/* DISMISSED MEANS WALKED AWAY, NOT "THE PANEL CLOSED".

   wallToAuth() called closeAccountWall(), which logged a dismissal --
   so every person who TAPPED THROUGH also counted as one. The number
   that says whether this wall is worth keeping is dismissed over
   shown, and it was inflated by exactly the people who did the thing
   the wall exists for.

   The close is now silent by default and the dismissal is logged only
   where somebody actually turns it down: the X, the backdrop, or the
   Escape key. */
function closeAccountWall(silent){
  var el = document.getElementById('cgWall');
  if(el) el.innerHTML = '';
  if(!silent){
    wallDismissCount++;
    logEvent('account_wall_dismissed', String(wallDismissCount), false);
  }
}

function wallToAuth(){
  logEvent('account_wall_clicked', null, false);
  closeAccountWall(true);   /* not a dismissal -- they took the offer */
  openAuth();
}

/* Signing in clears the count. Somebody who makes an account and later
   signs out on the same device should not meet the wall again with no
   scans left -- they already did the thing it asked for. */
function clearFreeScanCount(){
  try{ localStorage.removeItem(SCAN_COUNT_KEY); }catch(e){}
}


/* PROVE THE STORAGE WORKS BEFORE PROMISING TO USE IT.

   This scanner runs inside an iframe on the Wix homepage, at a
   filesusr.com origin rather than cardgauge.com. Storage there is
   third-party: Safari and Chrome partition or block it, and Safari's
   ITP clears it after seven days of inactivity even when it is
   allowed. The standalone at scan.cardgauge.com is a direct origin and
   has none of those problems.

   If storage is unavailable, offering a local save would tell somebody
   their card was kept and then lose it -- worse than the account wall
   it replaces, because the wall at least fails honestly. So it is
   tested once at load, and when it fails the old sign-in path is used
   unchanged. */
var LOCAL_OK = (function(){
  try{
    var k = '__cg_probe__';
    localStorage.setItem(k,'1');
    var ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok;
  }catch(e){ return false; }
})();
try{
  if(!LOCAL_OK) logEvent('local_storage_unavailable', (window.top !== window.self) ? 'iframe' : 'top', false);
}catch(e){}

/* THE LOCAL_OK GUARDS WERE IN THE STANDALONE AND MISSING HERE.

   Found 2026-09-02 by diffing the two scanners. The standalone has
   `if(!LOCAL_OK) return false;` on the write; this copy did not.

   The try/catch is not the same protection. Where storage is blocked
   -- private mode, a locked-down in-app browser, quota exhausted --
   some browsers throw (caught, returns false, fine) and some silently
   accept a write that does not persist. In that second case this
   returned TRUE for a card that was never kept, so the person saw
   "kept on this device" and had nothing.

   LOCAL_OK is set by an explicit probe at startup, so it knows the
   answer before anything is at stake. Checking it first means the
   honest failure path runs instead of a false success. */
function localBinder(){
  if(!LOCAL_OK) return [];
  try{ var r = localStorage.getItem(LOCAL_BINDER_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; }
  catch(e){ return []; }
}
function localBinderWrite(a){
  if(!LOCAL_OK) return false;
  try{ localStorage.setItem(LOCAL_BINDER_KEY, JSON.stringify(a.slice(0,200))); return true; }
  catch(e){ return false; }   // private mode, or quota
}
function localBinderHas(name){
  var k = String(name||'').toLowerCase();
  return localBinder().some(function(c){ return String(c.name||'').toLowerCase() === k; });
}
/* Same field set the authenticated insert uses, so a later migration is
   a straight map rather than a reconstruction. */
function localCardFrom(d, price){
  return {
    name: String(d.cardName||'Card').slice(0,200),
    image: d.image || null,
    price: price || null,
    year: d.year || null, brand: d.brand || null, set: d.set || null,
    player: d.player || null, number: d.cardNumber || null,
    parallel: d.parallel || null, sport: d.sport || null,
    query: String(d.searchQuery||'').slice(0,300),
    savedAt: new Date().toISOString()
  };
}
function localBinderSave(d, price){
  if(localBinderHas(d.cardName)) return 'already';
  var a = localBinder();
  a.unshift(localCardFrom(d, price));
  return localBinderWrite(a) ? 'saved' : 'failed';
}

/* WHAT THE ACCOUNT IS ACTUALLY FOR.

   Once cards are already kept, "sign up to save" is a lie -- they are
   saved. So the ask changes to the two things a local save genuinely
   cannot do: survive a new phone, and email you when a price moves.
   Both are true, both are worth an email address, and neither is
   withheld artificially.

   Shown from the first local save so the person can see their cards
   exist. The device warning is not fine print: it is the sentence that
   keeps this honest, and it sits next to the count rather than under
   it. */
async function mergeLocalBinder(){
  if(!LOCAL_OK || !sbReady() || !currentUser) return;
  var cards = localBinder();
  if(!cards.length) return;

  /* Names already in the account. A card kept locally and then saved
     again after signing in must not become two rows. */
  var have = {};
  try{
    var ex = await SB.from('watchlist_items').select('card_name').eq('user_id', currentUser.id);
    (ex.data||[]).forEach(function(r){ have[String(r.card_name||'').toLowerCase()] = 1; });
  }catch(e){ return; }

  var moved = 0, failed = 0;
  for(var i=0;i<cards.length;i++){
    var c = cards[i];
    if(have[String(c.name||'').toLowerCase()]) { moved++; continue; }
    try{
      var yr = parseInt(c.year,10);
      var r = await SB.from('watchlist_items').insert({
        user_id: currentUser.id,
        card_name: String(c.name||'Card').slice(0,200),
        card_image_url: c.image || null,
        price_when_added: c.price || null,
        current_price: c.price || null,
        status: c.status || 'watching',
        source: 'scanner_local',
        last_checked_at: new Date().toISOString(),
        year: (yr >= 1860 && yr <= 2100) ? yr : null,
        brand: c.brand || null, set_name: c.set || null, player: c.player || null,
        card_number: c.number || null, parallel: c.parallel || null, sport: c.sport || null
      });
      if(r.error) throw r.error;
      moved++;
    }catch(e){ failed++; }
  }

  if(!failed){
    try{ localStorage.removeItem(LOCAL_BINDER_KEY); }catch(e){}
    logEvent('local_cards_merged', String(moved), false);
    if(moved) toast('\u2705 ' + moved + ' card' + (moved===1?'':'s') + ' moved into your binder');
  } else {
    logEvent('local_cards_merge_partial', String(moved)+'/'+cards.length, false);
  }
}

/* ASKED ONCE, NOT EVERY TIME.

   The prompt exists to convert, not to nag. Somebody who declines and
   keeps scanning has answered the question, and re-asking on every
   save rebuilds the wall in a friendlier font. Dismissed once, it
   stays gone for the session and comes back only after several more
   cards -- by which point the ask means something different. */
var LOCAL_ASK_KEY = 'cg_local_ask_dismissed';
function localAskDismissed(){
  try{ return sessionStorage.getItem(LOCAL_ASK_KEY) === '1'; }catch(e){ return false; }
}
function dismissLocalAsk(){
  try{ sessionStorage.setItem(LOCAL_ASK_KEY,'1'); }catch(e){}
  logEvent('local_ask_dismissed', String(localBinder().length), false);
  renderLocalPrompt();
}

/* A HARDWARE FIX FOR THE ONE PROBLEM NO PROMPT CHANGE SOLVES.

   Glare on chrome, refractor and prizm stock is the biggest single
   cause of a card being misread. A clip-on circular polariser cuts
   specular reflection off the card's lacquer -- the standard answer in
   product photography, and it works here for the same reason.

   SHOWN ONLY WHEN THE CARD IS ACTUALLY SHINY, and once per session.
   After a 1987 Topps common this would be an advert; after a Chrome
   refractor that came back uncertain it is the answer to the problem
   they just had. Anything shown on every result stops being read, and
   the one thing this scanner cannot afford is for its warnings to
   become wallpaper.

   Affiliate, and it says so. */
var cplShown = false;
var SHINY_RE = /(refractor|chrome|prizm|optic|finest|holo|foil|mojo|wave|shimmer|cracked ice|sparkle|select)/i;

/* A REDEMPTION IS A VOUCHER, NOT A CARD.

   Raised by a real user's kid, which is where this kind of thing
   always comes from: should he scan a redemption card?

   Two reasons the answer is no, and the first one costs money.

   A redemption carries a code, and that code is bearer value --
   whoever types it into the manufacturer's site first receives the
   card, whether or not they hold the paper. Photographing it puts the
   code in an image that leaves the device. On an unredeemed slip that
   is a card someone can simply take.

   The second reason is that pricing it is meaningless anyway. What a
   redemption is worth depends entirely on the card it redeems FOR, and
   that card is not on the slip. Any number here would be priced off
   the wrong thing.

   So the panel refuses outright rather than showing a weak price with
   a caveat. This is the one case where no answer is plainly the right
   answer. */
function buildRedemptionWarning(d){
  if(!d || d.isRedemption !== true) return '';
  logEvent('redemption_detected', null, !!d.usedBack);
  return '<div class="redeem">'
    + '<div class="redeem-h">\u26a0 This is a redemption card, not the card itself</div>'
    + '<div class="redeem-p">'
      + 'A redemption is a voucher you exchange on the manufacturer\'s site for the real card. '
      + '<b>CardGauge won\'t price it</b> \u2014 what it is worth depends entirely on the card it redeems for, '
      + 'and that card is not on this slip.'
    + '</div>'
    + '<div class="redeem-p" style="margin-top:9px"><b>If you haven\'t redeemed it yet, be careful with the photo.</b> '
      + 'The code on a redemption works for whoever enters it first, whether or not they own the card. '
      + 'Don\'t post it, don\'t message it, and cover the code if you photograph it. '
      + 'We don\'t read or store the code.'
    + '</div>'
    + '<div class="redeem-p" style="margin-top:9px">Redeem it first. Then scan the card you actually receive \u2014 that one has a price.</div>'
  + '</div>';
}

/* ── A NUMBERED CARD PRICED AGAINST BASE COPIES ─────────────────

   The server sets serialDropped when it read a serial off the card,
   put it in the tight query, found nothing, and fell back to a query
   that does not carry it. The price on screen is then for the base
   version.

   THIS IS THE WORST KIND OF WRONG NUMBER THIS APP PRODUCES, because
   nothing else catches it. The comps are clean, so there is no
   contamination warning. There are plenty of them, so there is no thin
   warning. The spread is normal. Everything looks right and the number
   is for a different card.

   Real cost of it: a collector saved 25 high-end numbered cards on
   23 August, one of which was a Topps Finest /20 that CardGauge valued
   at $2, and never came back.

   Deliberately styled as a warning rather than a note. A base price on
   a /20 can be wrong by a hundred times, which is the same order as an
   autograph priced off base -- and that case has had a loud warning
   for months. */
function buildSerialWarning(d){
  if(!d || !d.serialDropped) return '';
  var ser = String(d.serialRead || '').replace(/^\//,'');
  logEvent('serial_dropped_warning', String(d.cardName||'').slice(0,120), !!d.usedBack);
  return '<div class="warn-box">'
    + '<div class="warn-h">\u26a0 This price is for the base card, not your numbered one.</div>'
    + '<div class="warn-p">We read <b>/' + esc(ser) + '</b> off the card, but no completed sales '
      + 'came back for that version \u2014 so the number above is what unnumbered copies sell for. '
      + 'A numbered card is usually worth <b>a lot more</b>.'
      + '<br><br>Tap <b>EDIT</b> on the search below and add <b>/' + esc(ser) + '</b> to see if '
      + 'any have sold, or check the sold listings yourself.</div>'
    + '</div>';
}

function buildGlareTip(d){
  if(cplShown) return '';
  var hay = [d.parallel, d.set, d.brand, d.cardName].filter(Boolean).join(' ');
  var shiny = SHINY_RE.test(hay);
  var shaky = String(d.confidence||'').toLowerCase() === 'low'
           || (d.parallelCertain === false);
  /* Never when the back was already used and confidence is fine --
     nagging about a step they took is how a tip gets ignored on the
     card where it matters. Fired on 36% of scans. */
  if(d.usedBack && !shaky) return '';
  if(!(shiny && shaky) && !(shiny && !d.usedBack)) return '';
  cplShown = true;
  logEvent('glare_tip_shown', String(d.cardName||'').slice(0,120), !!d.usedBack);
  /* Collapsed by default. The tip is worth showing on a shiny card;
     it is not worth a paragraph, a button and a disclaimer every time,
     above the correction fields somebody actually came to use. */
  return '<div class="cpl cplfold">'
    + '<div class="cpl-h">Shiny card, shaky read? <i>\u25BE</i></div>'
    + '<div class="cpl-body"><div class="cpl-p">Chrome and refractor surfaces throw glare that moves with the angle, '
      + 'so the same card can read differently shot twice. Softer light and a slight tilt fix most of it, free. '
      + 'A clip-on <b>polarising (CPL) filter</b> for your phone &mdash; about $15 &mdash; removes most of the rest.</div>'
    + '<a class="cpl-btn" href="https://www.amazon.com/s?k=clip+on+CPL+polarizing+filter+for+phone+camera&tag=cardgauge-20" '
      + 'target="_blank" rel="noopener sponsored" '
      + 'onclick="logEvent(\'glare_tip_clicked\',null,false)">See CPL filters \u2197</a>'
    + '<div class="cpl-fine">Affiliate link \u2014 costs you nothing, and we don\'t set the prices.</div>'
    + '</div>'
  + '</div>';
}

function renderLocalPrompt(){
  var el = document.getElementById('localBinderBox');
  if(!el) return;
  if(currentUser){ el.innerHTML = ''; return; }
  var cards = localBinder();
  if(!cards.length){ el.innerHTML = ''; return; }

  var list = cards.slice(0, 6).map(function(c){
    return '<div class="lb-row"><span class="lb-name">' + esc(c.name) + '</span>'
      + '<span class="lb-val">' + (c.price ? fmtMoney(c.price) : '\u2014') + '</span></div>';
  }).join('');

  el.innerHTML = '<div class="lb">'
    + '<div class="lb-top"><b>Your cards</b> <span class="lb-n">'
      + cards.length + ' kept on this device</span></div>'
    + list
    + (cards.length > 6 ? '<div class="lb-more">and ' + (cards.length - 6) + ' more</div>' : '')
    /* TWO ASKS, SMALLEST FIRST.

       This used to be one button and that button was an account: an
       address, then leave the app, find the mail, copy a code, come
       back. Measured over 30 days, 25 people started that and 6
       finished -- three quarters of the intent spent on the round
       trip rather than the decision.

       So the first ask is now one field and nothing else. It buys
       exactly one thing and says so: we email you when these move.
       No code, no password, no login.

       The account stays underneath it, unchanged, because it does
       something the email genuinely cannot -- carry the cards to
       another phone. That is now a real distinction rather than a
       toll, and it is the honest reason to sign up later.

       Ordered small-to-large deliberately. Somebody who gives an
       address has already said yes once; the account ask reads very
       differently after that than it does cold. */
    /* ONE ASK, NOT TWO STACKED ON EACH OTHER.

       This panel had an email field AND an account button underneath
       it, one after the other, both green, both about keeping cards.
       Read cold it looks like being asked the same thing twice with
       slightly different wording -- which is what it was.

       They are not the same thing, and the difference is worth exactly
       one line rather than two blocks:

         an email  -> we tell you when these move. Nothing to click,
                      no code, no password.
         an account -> the cards themselves survive a cleared browser
                      and open on another phone.

       So the email field is THE ask, because it is the smaller one and
       because the round trip is what loses people -- 25 sign-ups
       started in 30 days, 6 finished. The account becomes one quiet
       line beneath it for the person who wants the bigger thing, not a
       second full-width green button competing with the first.

       Once the email is in, the whole block collapses to a single line
       of confirmation plus that same quiet account link. Nothing green
       remains, because there is nothing left to do. */
    + ((localAskDismissed() && cards.length < 5) ? '' : '<div class="lb-cta">'
      + (emailWatchDone()
          ? '<div class="lb-why"><b>\u2713 We\u2019ll email you when these move.</b></div>'
          : '<div class="lb-why">'
              + (emailWatchState()
                  ? '<b>You\u2019ve kept ' + (cards.length - emailWatchState().count)
                    + ' more since.</b> Same email and we\u2019ll watch '
                    + (cards.length - emailWatchState().count === 1 ? 'that one' : 'those') + ' too.'
                  : '<b>Get an email when these move.</b> '
                    + 'No account, no password, nothing to click.')
              + '</div>'
            + '<div class="lb-mail">'
              /* Prefilled when we already have it -- retyping an address
                 you gave five minutes ago to cover two more cards is a
                 tax on the exact behaviour we want. */
              + '<input id="lbEmail" type="email" inputmode="email" autocomplete="email" '
                + 'value="' + (emailWatchState() ? esc(emailWatchState().email) : '') + '" '
                + 'placeholder="you@email.com" onkeydown="if(event.key===\'Enter\')submitEmailWatch()">'
              + '<button onclick="submitEmailWatch()">Alert me</button>'
            + '</div>'
            + '<div id="lbMailMsg" class="lb-fine"></div>')
      /* The account, as a line rather than a button. Says the one thing
         it does that the email cannot, and says what it costs, so
         nobody taps it expecting the no-code path. */
      /* THE MOVE, SAID ONLY TO THE PEOPLE IT COSTS SOMETHING.

         CardGauge moves to app.cardgauge.com on 21 September. Browser
         storage is per-origin, so cards kept on a device do not travel
         with it -- they are not deleted, they are unreachable from the
         new address. Measured 9 Sept: 12 people, 15 cards, not one of
         them with an account.

         This panel only renders when somebody HAS local cards and is
         NOT signed in, which is exactly that group and nobody else. So
         the notice is targeted by construction rather than by a rule --
         a visitor with an account never sees it, and neither does
         somebody who has saved nothing.

         Dated, and it removes itself. After the 21st the line is wrong
         and the ordinary copy is right, so the cutoff is in the code
         rather than on a list of things to remember to delete.

         Deliberately not a countdown and not a warning colour. The ask
         underneath is unchanged; this only supplies the reason it
         matters this month. */
      + (function(){
          var CUTOVER = new Date('2026-09-22T00:00:00-04:00').getTime();
          if(Date.now() >= CUTOVER){
            return '<div class="lb-alt">These cards live in this browser only. '
              + '<a onclick="openAuth()">Sign in to keep them anywhere \u2192</a>'
              + '<span class="lb-alt-fine">one email and a code, no password</span></div>';
          }
          return '<div class="lb-alt">These cards live in this browser only, and '
            + '<b>CardGauge moves to a new address on 21 September</b> \u2014 cards kept '
            + 'here will not come across. An account brings them with you. '
            + '<a onclick="openAuth()">Sign in to keep them \u2192</a>'
            + '<span class="lb-alt-fine">one email and a code, no password</span></div>';
        })()
      + '<button class="lb-no" onclick="dismissLocalAsk()">Not now</button>'
    + '</div>')
  + '</div>';
}

/* Remembered per browser so the field does not keep asking somebody
   who already answered. Deliberately NOT proof of anything -- the
   server is the record; this only decides which of the two asks to
   draw. */
var EMAIL_WATCH_KEY = 'cg_email_watch';

/* STORING JUST THE ADDRESS MEANT LATER CARDS WERE NEVER WATCHED.

   submitEmailWatch() sends whatever is kept at the moment somebody
   taps Alert me. This flag then hid the field permanently -- so every
   card kept AFTER that got no alerts, and nothing on the page said so.
   One card watched, a growing binder, and no way to add to it.

   The count of cards covered is stored alongside the address. When the
   binder has grown past it the field comes back, asking only about the
   difference. Somebody who keeps nothing new is never asked again,
   which was the point of hiding it in the first place. */
function emailWatchState(){
  try{
    var raw = localStorage.getItem(EMAIL_WATCH_KEY);
    if(!raw) return null;
    /* Older installs stored a bare address. Treated as covering
       everything kept at the time, which is the honest reading -- it
       is what actually happened. */
    if(raw.indexOf('|') < 0) return { email: raw, count: localBinder().length };
    var bits = raw.split('|');
    return { email: bits[0], count: parseInt(bits[1], 10) || 0 };
  }catch(e){ return null; }
}
function emailWatchDone(){
  var st = emailWatchState();
  if(!st) return false;
  return localBinder().length <= st.count;
}

/* Sends every kept card, not just the last one. Somebody who typed an
   address after keeping eight cards meant all eight -- asking again
   per card would be the round trip this replaces, in a new costume. */
async function submitEmailWatch(){
  var input = document.getElementById('lbEmail');
  var msg   = document.getElementById('lbMailMsg');
  if(!input) return;
  var email = String(input.value || '').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    if(msg) msg.innerHTML = '<span style="color:#f87171">That doesn\u2019t look like an email address.</span>';
    return;
  }

  var cards = localBinder();
  if(!cards.length) return;
  input.disabled = true;
  if(msg) msg.textContent = 'Setting up alerts\u2026';

  var ok = 0;
  for(var i = 0; i < cards.length && i < 25; i++){
    try{
      var r = await fetch(API + '/api/watch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          cardName: cards[i].name,
          query: cards[i].query || cards[i].name,
          price: cards[i].price || 0,
          source: 'local_prompt'
        })
      });
      var d = await r.json();
      if(d && d.success) ok++;
    }catch(e){}
  }

  if(ok){
    /* email|count -- the count is what lets the field come back when
       the binder grows. See emailWatchState(). */
    try{ localStorage.setItem(EMAIL_WATCH_KEY, email + '|' + cards.length); }catch(e){}
    logEvent('email_watch_added', String(ok), false);
    /* toast(), not showToast(). showToast is the BINDER's name for this;
       the scanners call it toast(). Written from memory of the wrong
       file, so the success path threw a ReferenceError right after the
       email had already been saved server-side -- no toast, the prompt
       never re-rendered, and the input sat disabled on "Setting up
       alerts..." looking like a failure it wasn't. */
    toast('\u2705 We\u2019ll email you when these move');
    renderLocalPrompt();
  } else {
    input.disabled = false;
    if(msg) msg.innerHTML = '<span style="color:#f87171">Couldn\u2019t set that up just now.</span>';
  }
}

async function saveToBinder(status, btn){
  status = status || 'watching';   // bare calls (the post-signup continuation) keep the old default
  if(!lastResult) return;
  if(!sbReady()){ toast('Accounts unavailable right now \u2014 scanning still works'); return; }
  if(!currentUser){
    /* THE CAP WAS CHECKED BELOW THIS RETURN, SO IT NEVER RAN.

       The free-card limit is enforced further down, in the account
       branch. This branch ends in `return`, so a signed-out saver never
       reached it -- and since 1 Sept the signed-out path is the common
       one. Measured 12 Sept: eleven cards saved locally in a row with no
       wall, and pro_wall not firing once in thirty days across eighty-two
       binder views. Not a logging gap. The gate was simply upstream of
       nobody.

       What Pro sells is an unlimited binder. It was free to anyone who
       never made an account.

       The account wall, not the Pro wall. Somebody with no account who
       hits eleven cards is not a person weighing $12.99 a month -- they
       are a person who has not signed up yet, and a free account is the
       thing the 1 Sept redesign exists to produce. Pro is the next gate
       along, and it already works for account holders. */
    if(!isPro && localBinder().length >= FREE_CARD_LIMIT
       && !localBinderHas(lastResult.cardName)){
      /* NOT showAccountWall(). That wall's copy is about the three free
         scans, and it sits behind the dismiss counter built to stop scan
         nagging -- a binder-full prompt routed through it would show the
         wrong words and could suppress itself silently.

         pendingSave is the same mechanism the private-mode branch below
         uses: the card is saved for them the moment the account exists,
         so signing up finishes the action they were already taking
         rather than making them find the card again. */
      logEvent('local_cap_reached', String(lastResult.cardName||'').slice(0,200));
      toast('That\u2019s ' + FREE_CARD_LIMIT + ' cards on this device \u2014 a free account keeps them all');
      pendingSave = true; pendingSaveStatus = status;
      openAuth();
      return;
    }

    /* Kept on the device, now, with no account. status is preserved on
       the local row so a later migration knows whether they said they
       own it or are watching it. */
    var st = computeStats(lastResult);
    var pr = safeNum(lastResult.sold && lastResult.sold.soldMedian) || safeNum(st.avg);
    var card = localCardFrom(lastResult, pr);
    card.status = status || 'watching';
    var res;
    if(localBinderHas(lastResult.cardName)) res = 'already';
    else { var arr = localBinder(); arr.unshift(card); res = localBinderWrite(arr) ? 'saved' : 'failed'; }
    if(res === 'failed'){
      pendingSave = true; pendingSaveStatus = status; openAuth(); return;   // private mode
    }
    toast(res === 'already' ? 'Already in your cards on this device'
                            : '\u2705 Kept on this device');
    savedKeys[String(lastResult.cardName||'').toLowerCase()] = true;
    logEvent('card_saved_local', String(lastResult.cardName||'').slice(0,200), !!lastResult.usedBack);
    var bb = document.getElementById('bannerSaveBtn');
    if(bb){ bb.disabled = true; bb.textContent = '\u2713 Kept on this device'; bb.style.opacity = '.6'; }
    var kb = document.getElementById('naKeepBtn'), wb = document.getElementById('naWatchBtn');
    if(kb){ kb.disabled = true; kb.querySelector('.na-label-text').textContent = status==='own' ? '\u2713 Kept' : 'Kept'; }
    if(wb){ wb.disabled = true; wb.querySelector('.na-label-text').textContent = status==='watching' ? '\u2713 Watching' : 'Watching'; }
    renderLocalPrompt();
    return;
  }
  /* No single button element when this fires from the post-signup
     continuation — fall back to whichever na-save-btn is still live
     on screen, since the result gets re-rendered with fresh buttons
     right before this runs. */
  var btns = btn ? [btn] : Array.prototype.slice.call(document.querySelectorAll('.na-save-btn'));
  btns.forEach(function(b){ b.disabled = true; b.querySelector('.na-label-text').textContent = 'Saving\u2026'; });
  try{
    var n = isPro ? 0 : await watchedCount();
    if(!isPro && n >= FREE_CARD_LIMIT){
      showProWall('scanner_save_full');
      btns.forEach(function(b){ b.disabled=false; });
      var kb=document.getElementById('naKeepBtn'); if(kb) kb.querySelector('.na-label-text').textContent='Keep it';
      var wb=document.getElementById('naWatchBtn'); if(wb) wb.querySelector('.na-label-text').textContent='Watch it';
      return;
    }
    var d = lastResult;
    var st = computeStats(d);
    var price = safeNum(d.sold && d.sold.soldMedian) || safeNum(st.avg);

    /* The scan knows year, brand, set, player, card number and parallel.
       Flattening them into card_name and discarding the parts is why a
       binder can be searched but not sorted, grouped or checked against
       a set. Keep them.

       Placeholders get dropped — the AI answers "Unknown" for a set it
       can't read, which is fine to receive and useless to store. A null
       sorts last; the string "Unknown" sorts between T and V and looks
       like a real set name.

       STORAGE USES A NARROWER FILTER THAN THE DISPLAY LINE. notJunk also
       strips "Base" and "Base Set", which is right above a price on a
       sports card — nobody writes it in a listing. But Base Set is the
       actual NAME of the 1999 Pokemon set, and the most collected set
       there is. Nulling it would lose the field on exactly the cards
       somebody most wants sorted. Only genuinely empty values go.

       A typed search has no AI behind it and legitimately has none of
       this, so every field is optional. */
    var EMPTY_VALUE = /^(unknown|n\/a|na|none|null|-|\?)$/i;
    var field = function(v){
      var t = String(v == null ? '' : v).trim();
      return (!t || EMPTY_VALUE.test(t)) ? null : t.slice(0,120);
    };
    var yr = parseInt(d.year, 10);

    var res = await SB.from('watchlist_items').insert({
      user_id:          currentUser.id,
      card_name:        String(d.cardName||'Card').slice(0,200),
      card_image_url:   d.image || null,
      price_when_added: price || null,
      current_price:    price || null,
      status:           status,
      source:           'scanner',
      last_checked_at:  new Date().toISOString(),
      year:             (yr >= 1860 && yr <= 2100) ? yr : null,
      brand:            field(d.brand),
      set_name:         field(d.set),
      player:           field(d.player),
      card_number:      field(d.cardNumber),
      parallel:         field(d.parallel),
      /* Two sets can share a name, a year and a brand and still be
         different sets — 1986 Topps is 792 cards in baseball and 396 in
         football. Without this, looking up a set size hands a football
         collector the baseball number. */
      sport:            field(d.sport)
    });
    if(res.error) throw res.error;
    toast('\u2705 Saved to your binder');
    logEvent('card_saved', String(d.cardName||'Card').slice(0,200), false);
    /* Keeping a card is the second real conversion — it is the whole
       point of an account, and the step almost nobody takes. Worth
       reporting so Meta can find more people who do it. */
    try{ if(window.fbq) fbq('track','AddToWishlist',{content_name:'card_saved',
      content_type:'product', value:Number(d.soldMedian||0)||0, currency:'USD'}); }catch(e){}
    /* card_saved fires for every completed save, own or watching — kept
       that way so nothing already relying on "a save happened" breaks.
       card_watched is layered on top, only for the watching path, so
       the funnel can tell keep-completions and watch-completions apart
       without redefining what card_saved has always meant. */
    if(status === 'watching'){
      logEvent('card_watched', String(d.cardName||'Card').slice(0,200), false);
    }
    if(window.ttq) ttq.track('AddToWishlist',{content_name:d.cardName,content_type:'scanner_save'});if(window.fbq)fbq('track','AddToWishlist',{content_name:d.cardName,content_type:'scanner_save'});
    /* Remember it in STATE, not just on the button. The saved look used
       to live only in the DOM node's text, so anything that rebuilt the
       result — a re-price, a refinement chip, an auth change — silently
       reverted a saved card to looking unsaved. */
    savedKeys[String(d.cardName||'').toLowerCase()] = true;
    /* Both buttons get a final state, whichever one was actually
       clicked — the other stays visible but disabled, so it's clear
       the card was kept, and clear which of the two ways it was kept,
       without either button just vanishing. */
    var keepBtn  = document.getElementById('naKeepBtn');
    var watchBtn = document.getElementById('naWatchBtn');
    if(keepBtn){
      keepBtn.disabled = true;
      keepBtn.querySelector('.na-label-text').textContent = status === 'own' ? '\u2713 Kept' : 'Kept elsewhere';
    }
    if(watchBtn){
      watchBtn.disabled = true;
      watchBtn.querySelector('.na-label-text').textContent = status === 'watching' ? '\u2713 Watching' : 'Watching elsewhere';
    }
    if(true){
      var anchorBtn = btn || keepBtn || watchBtn;
      /* A save that just says "done" and stops is a dead end, not a
         conversion. The toast fades in two seconds and the buttons
         just sit there disabled — nothing on screen suggests there
         IS a next step, which is exactly the moment somebody who just
         became a collector needs one. Injected once, right after the
         panel, so it reads as the natural next line rather than a
         bolted-on banner. */
      try{
        var row = anchorBtn ? anchorBtn.closest('.save-row') : document.querySelector('.next-actions.save-row');
        if(row && !(row.nextElementSibling && row.nextElementSibling.classList
                     && row.nextElementSibling.classList.contains('whats-next'))){
          var nextEl = document.createElement('div');
          nextEl.className = 'whats-next';
          nextEl.innerHTML = '<a href="'+BINDER_PAGE+'" target="_blank" rel="noopener" '
            + 'onclick="if(window.ttq)ttq.track(\'ClickButton\',{content_name:\'whatsnext_view_binder\',content_type:\'scanner\'})">'
            + 'View your binder \u2192</a>'
            + '<span class="whats-next-sep">\u00b7</span>'
            + '<a onclick="scanAnotherNudge()">Scan another card</a>';
          row.insertAdjacentElement('afterend', nextEl);
        }
      }catch(e){}
      return;
    }
  }catch(e){
    toast('Could not save: '+(e.message||'try again'));
  }
  /* Failure path — put both buttons back exactly as they were, not
     just whichever one was clicked, since either could have been the
     one that failed and both were disabled the moment the attempt
     started. */
  btns.forEach(function(b){ b.disabled = false; });
  var kb2 = document.getElementById('naKeepBtn');
  if(kb2) kb2.querySelector('.na-label-text').textContent = 'Keep it';
  var wb2 = document.getElementById('naWatchBtn');
  if(wb2) wb2.querySelector('.na-label-text').textContent = 'Watch it';
}

/* Scrolls back to the actual scan/search card rather than just the top
   of the page — "scan another" should land somewhere you can
   immediately act, not require a second scroll to find the input. */
function scanAnotherNudge(){
  var el = document.querySelector('.scan-card');
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  if(window.ttq) ttq.track('ClickButton',{content_name:'whatsnext_scan_another',content_type:'scanner'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'whatsnext_scan_another',content_type:'scanner'});
}

/* Deferred script, so wait for it rather than racing it. */
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', checkAuthState);
} else {
  checkAuthState();
}

/* Came back from the email app mid sign-in? Put them back on the code
   step rather than an empty page. Only when they are not already signed
   in -- checkAuthState may resolve a session a moment later, and this
   closes itself if so. */
function resumePendingAuth(){
  if(!authEmailPending || currentUser) return;
  var m=document.getElementById('authModal'); if(!m) return;
  m.classList.add('show');
  var shown=document.getElementById('authEmailShown'); if(shown) shown.textContent=authEmailPending;
  var ef=document.getElementById('authEmail'); if(ef) ef.value=authEmailPending;
  var se=document.getElementById('authStepEmail'); if(se) se.style.display='none';
  var sc=document.getElementById('authStepCode'); if(sc) sc.style.display='';
  var cf=document.getElementById('authCode'); if(cf) cf.focus();
  logEvent('signup_resumed', null, false);
}
setTimeout(resumePendingAuth, 900);

/* Checkout carries the account id so the Stripe webhook turns Pro on for
   the right person even if they type a different email at the till. */
const STRIPE_PRO_LINK = 'https://buy.stripe.com/eVqcN5g9cb6o5W40eD38401';
const STRIPE_PRO_LINK_ANNUAL = 'https://buy.stripe.com/28EeVd9KO2zSdow4uT38402';
var proPlan = 'monthly';

function setProPlan(plan){
  proPlan = plan;
  var mBtn = document.getElementById('proToggleMonthly');
  var aBtn = document.getElementById('proToggleAnnual');
  var amt  = document.getElementById('proAmt');
  var per  = document.getElementById('proPer');
  var intro= document.getElementById('proIntro');
  var cta  = document.getElementById('proCtaBtn');
  if(!mBtn || !aBtn) return;

  if(plan === 'annual'){
    aBtn.className = 'pro-toggle-btn on';
    aBtn.style.background = 'rgba(245,158,11,.14)'; aBtn.style.borderColor='rgba(245,158,11,.4)'; aBtn.style.color='var(--gold-warm)';
    mBtn.className = 'pro-toggle-btn';
    mBtn.style.background = 'var(--surface2)'; mBtn.style.borderColor='var(--border2)'; mBtn.style.color='var(--text2)';
    amt.textContent = '$119'; per.textContent = '/ year';
    intro.innerHTML = '◆ Works out to <b style="color:var(--green)">$9.92/mo</b> — cancel anytime';
    if(cta) cta.textContent = 'Get Pro — $119/yr';
  } else {
    mBtn.className = 'pro-toggle-btn on';
    mBtn.style.background = 'rgba(245,158,11,.14)'; mBtn.style.borderColor='rgba(245,158,11,.4)'; mBtn.style.color='var(--gold-warm)';
    aBtn.className = 'pro-toggle-btn';
    aBtn.style.background = 'var(--surface2)'; aBtn.style.borderColor='var(--border2)'; aBtn.style.color='var(--text2)';
    amt.textContent = '$12.99'; per.textContent = '/ month';
    intro.innerHTML = '◆ Cancel anytime — no contract';
    if(cta) cta.textContent = 'Get Pro — $12.99/mo';
  }
}

function proUrl(){
  var link = proPlan === 'annual' ? STRIPE_PRO_LINK_ANNUAL : STRIPE_PRO_LINK;
  var parts=[];
  if(currentUser){
    if(currentUser.email) parts.push('prefilled_email='+encodeURIComponent(currentUser.email));
    if(currentUser.id)    parts.push('client_reference_id='+encodeURIComponent(currentUser.id));
  }
  return parts.length ? link+'?'+parts.join('&') : link;
}
function goPro(e){
  if(e) e.preventDefault();
  if(window.ttq) ttq.track('Subscribe',{content_name:'cardgauge_pro_'+proPlan,value:(proPlan==='annual'?119:12.99),currency:'USD'});
  window.open(proUrl(),'_blank','noopener');
}

benchLoad();
benchRender();   // a reload mid-session keeps the bench
logEvent('visit');
/* page_view — added per the Aug 22 funnel audit. Additive, alongside
   'visit', not replacing it — existing dashboards that read 'visit'
   keep working unchanged. This one carries a page identifier so a
   future site-wide view can tell "visited home" apart from "visited
   pre-grade" once those pages carry the same call. */
logEvent('page_view', 'home', false);
renderCta(null, null, null);   // default panel until there's a result to react to
if(window.ttq)ttq.track('ViewContent',{content_name:'scanner_standalone',content_type:'landing'});if(window.fbq)fbq('track','ViewContent',{content_name:'scanner_standalone',content_type:'landing'});

// Real native share sheet on a phone (Messages, Mail, WhatsApp, whatever's
// installed) via navigator.share() -- same approach as the Business tool's
// share button, adapted for the main scanner. Falls back to copying a
// ready-to-paste message on browsers with no native share sheet (most
// desktop browsers), and to a plain prompt() if even clipboard access
// is blocked -- so this can't fail silently on any browser.
async function shareCardGauge(){
  /* Untracked until now, which is why the iframe failure went unnoticed
     for so long: navigator.share threw inside the Wix HTML component,
     the catch swallowed it, and nothing anywhere recorded that somebody
     had tried. Logged BEFORE the attempt, so a tap is counted whether
     or not the browser lets the share happen. */
  logEvent('share_clicked', null, false);
  const shareData={
    title:'CardGauge',
    text:"I've been using CardGauge to scan and price my sports cards — free. Worth a look if you collect.",
    url:'https://www.cardgauge.com'
  };
  if(window.ttq)ttq.track('ClickButton',{content_name:'share_cardgauge',content_type:'scanner_page'});if(window.fbq)fbq('trackCustom','Interaction',{content_name:'share_cardgauge',content_type:'scanner_page'});
  /* ONLY AN ABORT ENDS IT HERE.

     The old version returned after ANY failure, treating every error as
     "they closed the share sheet". Inside the Wix HTML component that
     is wrong in a way nothing surfaces: navigator.share exists in the
     iframe but throws NotAllowedError unless the frame carries
     allow="web-share", which Wix does not set. So on the surface with
     most of the traffic the button did nothing at all -- no share, no
     copy, no message.

     An AbortError is a real cancellation and should stop. Anything else
     means sharing was not available, and the clipboard fallback below
     is exactly what it is for. */
  if(navigator.share){
    try{ await navigator.share(shareData); return; }
    catch(e){ if(e && e.name === 'AbortError') return; }
  }
  const fallbackText=`${shareData.text}\n${shareData.url}`;
  try{
    await navigator.clipboard.writeText(fallbackText);
    alert('Link copied — paste it into a text, email, or DM.');
  }catch(e){
    prompt('Copy this to share:', fallbackText);
  }
}
</script>

<script>
if('serviceWorker' in navigator){
  /* An installed PWA is almost never fully closed on a phone, so without
     this someone could keep looking at the version they installed weeks
     ago while every fix shipped past them. Three parts:

       - check for a new worker on every load, and again hourly for a
         session that stays open all day
       - reload once when a new worker takes control, guarded so a worker
         that hands off repeatedly can't put the page in a reload loop
       - never reload mid-scan; a refresh that eats somebody's result is
         worse than showing them slightly stale code for one more minute */
  var cgReloading = false;
  var cgSwReady = null;

  navigator.serviceWorker.addEventListener('message', function(e){
    if(e.data && e.data.type === 'SW_UPDATED') cgMaybeReload();
  });
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    cgMaybeReload();
  });

  function cgBusy(){
    // mid-scan, mid-search, or mid-reprice — leave them alone
    if (typeof scanning !== 'undefined' && scanning) return true;
    if (typeof repricing !== 'undefined' && repricing) return true;
    if (typeof backPending !== 'undefined' && backPending) return true;
    return false;
  }

  function cgMaybeReload(){
    if (cgReloading) return;
    if (cgBusy()) { setTimeout(cgMaybeReload, 4000); return; }
    // Only ever reload once per page life.
    try { if (sessionStorage.getItem('cg_reloaded') === '1') return; } catch(e){}
    try { sessionStorage.setItem('cg_reloaded','1'); } catch(e){}
    cgReloading = true;
    window.location.reload();
  }

  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      cgSwReady = reg;
      reg.update();                                   // check on every load
      setInterval(function(){ reg.update(); }, 3600000); // and hourly
    }).catch(function(){});
  });
}
</script>
</body>
</html>
