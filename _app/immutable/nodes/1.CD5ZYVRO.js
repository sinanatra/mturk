import{s as d,b as l,t as g,h as p,j as u,l as _,d as i,p as h,i as f,v as m,w as v,n as b,B as E}from"../chunks/scheduler.Bx9lCxiB.js";import{S as $,i as x}from"../chunks/index.D00NIsm6.js";import{s as S}from"../chunks/entry.Qnz_2X0e.js";const y=()=>{const s=S;return{page:{subscribe:s.page.subscribe},navigating:{subscribe:s.navigating.subscribe},updated:s.updated}},C={subscribe(s){return y().page.subscribe(s)}};function j(s){let e,t,r=s[0].error.message+"",o;return{c(){e=l("article"),t=l("h1"),o=g(r),this.h()},l(a){e=p(a,"ARTICLE",{class:!0});var n=u(e);t=p(n,"H1",{class:!0});var c=u(t);o=_(c,r),c.forEach(i),n.forEach(i),this.h()},h(){h(t,"class","svelte-1lo401h"),h(e,"class","svelte-1lo401h")},m(a,n){f(a,e,n),m(e,t),m(t,o)},p(a,[n]){n&1&&r!==(r=a[0].error.message+"")&&v(o,r)},i:b,o:b,d(a){a&&i(e)}}}function q(s,e,t){let r;return E(s,C,o=>t(0,r=o)),[r]}let H=class extends ${constructor(e){super(),x(this,e,q,j,d,{})}};export{H as component};
