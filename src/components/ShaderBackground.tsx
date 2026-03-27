import { useEffect, useRef, useState } from 'react';

const vertexShaderSource = `#version 300 es
  in vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `#version 300 es
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform int u_mode;
  uniform float u_speed;
  uniform sampler2D iChannel0;

  out vec4 fragColor;

  float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
  float noise(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(x);
      x = rot * x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // --- Heartfelt Shader Functions ---
  #define S(a, b, t) smoothstep(a, b, t)
  // #define HAS_HEART // Disabled by default for continuous rain, uncomment if heart animation is desired
  #define USE_POST_PROCESSING

  vec3 N13(float p) {
      vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
  }

  vec4 N14(float t) {
      return fract(sin(t*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
  }

  float N(float t) {
      return fract(sin(t*12345.564)*7658.76);
  }

  float Saw(float b, float t) {
      return S(0., b, t)*S(1., b, t);
  }

  vec2 DropLayer2(vec2 uv, float t) {
      vec2 UV = uv;
      
      uv.y += t*0.75;
      vec2 a = vec2(6., 1.);
      vec2 grid = a*2.;
      vec2 id = floor(uv*grid);
      
      float colShift = N(id.x); 
      uv.y += colShift;
      
      id = floor(uv*grid);
      vec3 n = N13(id.x*35.2+id.y*2376.1);
      vec2 st = fract(uv*grid)-vec2(.5, 0);
      
      float x = n.x-.5;
      
      float y = UV.y*20.;
      float wiggle = sin(y+sin(y));
      x += wiggle*(.5-abs(x))*(n.z-.5);
      x *= .7;
      float ti = fract(t+n.z);
      y = (Saw(.85, ti)-.5)*.9+.5;
      vec2 p = vec2(x, y);
      
      float d = length((st-p)*a.yx);
      
      float mainDrop = S(.4, .0, d);
      
      float r = sqrt(S(1., y, st.y));
      float cd = abs(st.x-x);
      float trail = S(.23*r, .15*r*r, cd);
      float trailFront = S(-.02, .02, st.y-y);
      trail *= trailFront*r*r;
      
      y = UV.y;
      float trail2 = S(.2*r, .0, cd);
      float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
      y = fract(y*10.)+(st.y-.5);
      float dd = length(st-vec2(x, y));
      droplets = S(.3, 0., dd);
      float m = mainDrop+droplets*r*trailFront;
      
      return vec2(m, trail);
  }

  float StaticDrops(vec2 uv, float t) {
      uv *= 40.;
      
      vec2 id = floor(uv);
      uv = fract(uv)-.5;
      vec3 n = N13(id.x*107.45+id.y*3543.654);
      vec2 p = (n.xy-.5)*.7;
      float d = length(uv-p);
      
      float fade = Saw(.025, fract(t+n.z));
      float c = S(.3, 0., d)*fract(n.z*10.)*fade;
      return c;
  }

  vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
      float s = StaticDrops(uv, t)*l0; 
      vec2 m1 = DropLayer2(uv, t)*l1;
      vec2 m2 = DropLayer2(uv*1.85, t)*l2;
      
      float c = s+m1.x+m2.x;
      c = S(.3, 1., c);
      
      return vec2(c, max(m1.y*l0, m2.y*l1));
  }

  vec3 renderDown(vec2 fragCoord) {
    float t = u_time * u_speed;
    vec2 uv = (fragCoord.xy - .5 * u_resolution.xy) / u_resolution.y;
    vec2 UV = fragCoord.xy / u_resolution.xy;
    float T = t; // Use the speed-adjusted time

    float t_heart = T * .2;

    float rainAmount = sin(T * .05) * .3 + .7;

    float maxBlur = mix(3., 6., rainAmount);
    float minBlur = 2.;

    float staticDrops = S(-.5, 1., rainAmount) * 2.;
    float layer1 = S(.25, .75, rainAmount);
    float layer2 = S(.0, .5, rainAmount);

    vec2 c = Drops(uv, t_heart, staticDrops, layer1, layer2);
    vec2 e = vec2(.001, 0.);
    float cx = Drops(uv + e, t_heart, staticDrops, layer1, layer2).x;
    float cy = Drops(uv + e.yx, t_heart, staticDrops, layer1, layer2).x;
    vec2 n = vec2(cx - c.x, cy - c.x); // expensive normals

    float focus = mix(maxBlur - c.y, minBlur, S(.1, .2, c.x));
    
    vec2 sampleUV = clamp(UV + n, vec2(0.001), vec2(0.999));
    vec3 col = textureLod(iChannel0, sampleUV, focus).rgb;

    // Extra seam guard: gently blend across the screen midline to avoid transient
    // horizontal artifacts during mode switches into Down.
    float seamBand = 1.0 - smoothstep(0.0, 0.01, abs(UV.y - 0.5));
    if (seamBand > 0.0) {
      vec2 sampleUVUp = clamp(sampleUV + vec2(0.0, 0.002), vec2(0.001), vec2(0.999));
      vec2 sampleUVDown = clamp(sampleUV - vec2(0.0, 0.002), vec2(0.001), vec2(0.999));
      vec3 seamAvg = 0.5 * (textureLod(iChannel0, sampleUVUp, focus).rgb + textureLod(iChannel0, sampleUVDown, focus).rgb);
      col = mix(col, seamAvg, seamBand * 0.85);
    }

    // Remove residual horizontal line from source texture around the center band.
    float lineBand = exp(-pow((UV.y - 0.52) / 0.035, 2.0));
    if (lineBand > 0.001) {
      vec2 o1 = vec2(0.0, 0.018);
      vec2 o2 = vec2(0.0, 0.032);
      vec3 blurBand =
        textureLod(iChannel0, clamp(sampleUV + o1, vec2(0.001), vec2(0.999)), focus).rgb +
        textureLod(iChannel0, clamp(sampleUV - o1, vec2(0.001), vec2(0.999)), focus).rgb +
        textureLod(iChannel0, clamp(sampleUV + o2, vec2(0.001), vec2(0.999)), focus).rgb +
        textureLod(iChannel0, clamp(sampleUV - o2, vec2(0.001), vec2(0.999)), focus).rgb;
      blurBand *= 0.25;
      col = mix(col, blurBand, lineBand * 0.92);
      col += vec3(0.018, 0.016, 0.014) * lineBand;
    }

    #ifdef USE_POST_PROCESSING
    // Subtle ambient city light color shift
    float lightShift = sin(T * 0.5) * 0.5 + 0.5;
    vec3 warmLight = vec3(1.1, 0.9, 0.7); // Warm city glow
    vec3 coolLight = vec3(0.8, 0.9, 1.1); // Cool moonlight/neon
    vec3 ambientLight = mix(coolLight, warmLight, lightShift);
    
    // Apply subtle color shift to simulate distant changing lights
    col *= mix(vec3(1.0), ambientLight, 0.4); 
    
    col *= 1. - dot(UV - .5, UV - .5); // vignette
    #endif

    return col;
  }

  // --- End Heartfelt Shader Functions ---

  // --- Joy Mode Shader Functions ---
  #define joy_ORIG_CLOUD 0
  #define joy_ENABLE_RAIN 0
  #define joy_SIMPLE_SUN 0
  #define joy_NICE_HACK_SUN 1
  #define joy_SOFT_SUN 1
  #define joy_cloudy 0.5
  #define joy_haze (0.01 * (joy_cloudy*20.))
  #define joy_rainmulti 5.0
  #define joy_rainy (10.0 - joy_rainmulti)
  #define joy_fov 1.73205081
  #define joy_cameraheight 5e1
  #define joy_mincloudheight 5e3
  #define joy_maxcloudheight 8e3
  #define joy_xaxiscloud (u_time * u_speed * 5e2)
  #define joy_yaxiscloud 0.
  #define joy_zaxiscloud (u_time * u_speed * 6e2)
  #define joy_cloudnoise 2e-4

  const int joy_steps = 16;
  const int joy_stepss = 16;
  const float joy_R0 = 6360e3;
  const float joy_Ra = 6380e3;
  const float joy_I = 10.;
  const float joy_SI = 5.;
  const float joy_g = 0.45;
  const float joy_g2 = joy_g * joy_g;
  const float joy_ts = (joy_cameraheight / 2.5e5);
  const float joy_s = 0.999;
  const float joy_s2 = joy_s;
  const float joy_Hr = 8e3;
  const float joy_Hm = 1.2e3;
  const vec3 joy_bM = vec3(21e-6);
  const vec3 joy_bR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
  const vec3 joy_C = vec3(0., -joy_R0, 0.);
  const float joy_cloudnear = 1.0;
  const float joy_cloudfar = 70e3;

  mat2 joy_mm2(in float a){
      float c = cos(a);
      float s = sin(a);
      return mat2(c,s,-s,c);
  }
  mat2 joy_m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);
  float joy_tri(in float x){
      return clamp(abs(fract(x)-.5),0.01,0.49);
  }
  vec2 joy_tri2(in vec2 p){
      return vec2(joy_tri(p.x)+joy_tri(p.y),joy_tri(p.y+joy_tri(p.x)));
  }
  float joy_triNoise2d(in vec2 p, float spd) {
      float z=1.8;
      float z2=2.5;
      float rz = 0.;
      p *= joy_mm2(p.x*0.06);
      vec2 bp = p;
      for (float i=0.; i<5.; i++ ) {
          vec2 dg = joy_tri2(bp*1.85)*.75;
          dg *= joy_mm2(u_time * u_speed * spd);
          p -= dg/z2;
          bp *= 1.3;
          z2 *= 1.45;
          z *= .42;
          p *= 1.21 + (rz-1.0)*.02;
          rz += joy_tri(p.x+joy_tri(p.y))*z;
          p*= -joy_m2;
      }
      return clamp(1./pow(rz*29., 1.3),0.,.55);
  }
  float joy_hash21(in vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
  vec4 joy_aurora(vec3 ro, vec3 rd) {
      vec4 col = vec4(0);
      vec4 avgCol = vec4(0);
      ro *= 1e-5;
      float mt = 10.;
      for(float i=0.;i<5.;i++) {
          float of = 0.006*joy_hash21(gl_FragCoord.xy)*smoothstep(0.,15., i*mt);
          float pt = ((.8+pow((i*mt),1.2)*.001)-rd.y)/(rd.y*2.+0.4);
          pt -= of;
          vec3 bpos = (ro) + pt*rd;
          vec2 p = bpos.zx;
          float rzt = joy_triNoise2d(p, 0.1);
          vec4 col2 = vec4(0,0,0, rzt);
          col2.rgb = (sin(1.-vec3(2.15,-.5, 1.2)+(i*mt)*0.053)*(0.5*mt))*rzt;
          avgCol =  mix(avgCol, col2, .5);
          col += avgCol*exp2((-i*mt)*0.04 - 2.5)*smoothstep(0.,5., i*mt);
      }
      col *= (clamp(rd.y*15.+.4,0.,1.2));
      return col*2.8;
  }

  float joy_noise2(vec2 v) { return noise(v); }

  float joy_hash(vec3 p) {
      p = fract(p * vec3(443.8975, 397.2973, 491.1871));
      p += dot(p, p.yxz + 19.19);
      return fract(p.x * p.y * p.z);
  }
  float joy_Noise(in vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);
      f = f*f*(3.0-2.0*f);
      float n000 = joy_hash(p + vec3(0.0, 0.0, 0.0));
      float n100 = joy_hash(p + vec3(1.0, 0.0, 0.0));
      float n010 = joy_hash(p + vec3(0.0, 1.0, 0.0));
      float n110 = joy_hash(p + vec3(1.0, 1.0, 0.0));
      float n001 = joy_hash(p + vec3(0.0, 0.0, 1.0));
      float n101 = joy_hash(p + vec3(1.0, 0.0, 1.0));
      float n011 = joy_hash(p + vec3(0.0, 1.0, 1.0));
      float n111 = joy_hash(p + vec3(1.0, 1.0, 1.0));
      float x00 = mix(n000, n100, f.x);
      float x10 = mix(n010, n110, f.x);
      float x01 = mix(n001, n101, f.x);
      float x11 = mix(n011, n111, f.x);
      float y0 = mix(x00, x10, f.y);
      float y1 = mix(x01, x11, f.y);
      return mix(y0, y1, f.z);
  }

  float joy_fnoise( vec3 p, in float t ) {
      p *= .25;
      float f;
      f = 0.5000 * joy_Noise(p); p = p * 3.02; p.y -= t*.1;
      f += 0.2500 * joy_Noise(p); p = p * 3.03; p.y += t*.06;
      f += 0.1250 * joy_Noise(p); p = p * 3.01;
      f += 0.0625   * joy_Noise(p); p =  p * 3.03;
      f += 0.03125  * joy_Noise(p); p =  p * 3.02;
      f += 0.015625 * joy_Noise(p);
      return f;
  }

  float joy_cloud(vec3 p, in float t ) {
      float cld = joy_fnoise(p*joy_cloudnoise,t) + joy_cloudy*0.1 ;
      cld = smoothstep(.4+.04, .6+.04, cld);
      cld *= cld * (5.0*joy_rainmulti);
      return cld+joy_haze;
  }

  void joy_densities(in vec3 pos, out float rayleigh, out float mie, float t) {
      float h = length(pos - joy_C) - joy_R0;
      rayleigh =  exp(-h/joy_Hr);
      vec3 d = pos;
      d.y = 0.0;
      float dist = length(d);
      
      float cld = 0.;
      if (joy_mincloudheight < h && h < joy_maxcloudheight) {
          cld = joy_cloud(pos+vec3(joy_xaxiscloud,joy_yaxiscloud, joy_zaxiscloud),t)*joy_cloudy;
          cld *= sin(3.1415*(h-joy_mincloudheight)/joy_mincloudheight) * joy_cloudy;
      }
      if (dist>joy_cloudfar) {
          float factor = clamp(1.0-((dist - joy_cloudfar)/(joy_cloudfar-joy_cloudnear)),0.0,1.0);
          cld *= factor;
      }
      mie = exp(-h/joy_Hm) + cld + joy_haze;
  }

  float joy_escape(in vec3 p, in vec3 d, in float R) {
      vec3 v = p - joy_C;
      float b = dot(v, d);
      float c = dot(v, v) - R*R;
      float det2 = b * b - c;
      if (det2 < 0.) return -1.;
      float det = sqrt(det2);
      float t1 = -b - det, t2 = -b + det;
      return (t1 >= 0.) ? t1 : t2;
  }

  void joy_scatter(vec3 o, vec3 d, out vec3 col, out vec3 scat, in float t, vec3 Ds) {
      float L = joy_escape(o, d, joy_Ra);	
      float mu = dot(d, Ds);
      float opmu2 = 1. + mu*mu;
      float phaseR = .0596831 * opmu2;
      float phaseM = .1193662 * (1. - joy_g2) * opmu2 / ((2. + joy_g2) * pow(1. + joy_g2 - 2.*joy_g*mu, 1.5));
      float phaseS = .1193662 * (1. - joy_s2) * opmu2 / ((2. + joy_s2) * pow(1. + joy_s2 - 2.*joy_s*mu, 1.5));
      
      float depthR = 0., depthM = 0.;
      vec3 R = vec3(0.), M = vec3(0.);
      
      float dl = L / float(joy_steps);
      for (int i = 0; i < joy_steps; ++i) {
          float l = float(i) * dl;
          vec3 p = (o + d * l);

          float dR, dM;
          joy_densities(p, dR, dM, t);
          dR *= dl; dM *= dl;
          depthR += dR;
          depthM += dM;

          float Ls = joy_escape(p, Ds, joy_Ra);
          if (Ls > 0.) {
              float dls = Ls / float(joy_stepss);
              float depthRs = 0., depthMs = 0.;
              for (int j = 0; j < joy_stepss; ++j) {
                  float ls = float(j) * dls;
                  vec3 ps = ( p + Ds * ls );
                  float dRs, dMs;
                  joy_densities(ps, dRs, dMs, t);
                  depthRs += dRs * dls;
                  depthMs += dMs * dls;
              }

              vec3 A = exp(-(joy_bR * (depthRs + depthR) + joy_bM * (depthMs + depthM)));
              R += (A * dR);
              M += A * dM ;
          }
      }

      col = (joy_I) *(M * joy_bM * (phaseM ));
      #if joy_NICE_HACK_SUN
      col += (joy_SI) *(M * joy_bM *phaseS);
      #endif
      col += (joy_I) *(R * joy_bR * phaseR);
      scat = 0.1 *(joy_bM*depthM);
  }

  vec3 joy_hash33(vec3 p) {
      p = fract(p * vec3(443.8975,397.2973, 491.1871));
      p += dot(p.zxy, p.yxz+19.27);
      return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
  }

  vec3 joy_stars(in vec3 p) {
      vec3 c = vec3(0.);
      float res = u_resolution.x*2.5;
      for (float i=0.;i<4.;i++) {
          vec3 q = fract(p*(.15*res))-0.5;
          vec3 id = floor(p*(.15*res));
          vec2 rn = joy_hash33(id).xy;
          float c2 = 1.-smoothstep(0.,.6,length(q));
          c2 *= step(rn.x,.0005+i*i*0.001);
          c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.1+0.9);
          p *= 1.3;
      }
      return c*c*.8;
  }

  vec3 joy_waterNormal(in vec2 xz, in float t) {
      // Layered low-frequency waves for calmer and more natural ocean normals
      float w1 = sin(xz.x * 0.0021 + t * 0.78);
      float w2 = cos(xz.y * 0.0018 - t * 0.62);
      float w3 = sin((xz.x + xz.y) * 0.0014 + t * 0.55);
      float w4 = cos((xz.x - xz.y) * 0.0016 - t * 0.46);
      float w5 = sin((xz.x * 1.8 - xz.y) * 0.0012 + t * 0.9);

      float dhdx = 0.0021 * cos(xz.x * 0.0021 + t * 0.78) + 0.0014 * cos((xz.x + xz.y) * 0.0014 + t * 0.55) - 0.0016 * sin((xz.x - xz.y) * 0.0016 - t * 0.46) + 0.00216 * cos((xz.x * 1.8 - xz.y) * 0.0012 + t * 0.9);
      float dhdz = -0.0018 * sin(xz.y * 0.0018 - t * 0.62) + 0.0014 * cos((xz.x + xz.y) * 0.0014 + t * 0.55) + 0.0016 * sin((xz.x - xz.y) * 0.0016 - t * 0.46) - 0.0012 * sin((xz.x * 1.8 - xz.y) * 0.0012 + t * 0.9);

      float waveMix = (w1 + w2 + 0.8 * w3 + 0.6 * w4 + 0.5 * w5) * 0.5;
      vec3 n = normalize(vec3(-dhdx * (1.25 + 0.6 * waveMix), 1.0, -dhdz * (1.25 + 0.6 * waveMix)));
      return n;
  }

  vec3 renderJoy(vec2 fragCoord) {
      float AR = u_resolution.x/u_resolution.y;
      float M = 1.0;
      
      // Always keep the sun up and bright, adjust slightly with speed
      // u_speed is 0.1 to 3.0
      float mappedMouseY = 0.7 + (u_speed / 3.0) * 0.25; 
      vec2 uvMouse = vec2(0.5, mappedMouseY);
      
      vec2 uv0 = (fragCoord.xy / u_resolution.xy);
      uv0 *= M;
      
      vec2 uv = uv0 * (2.0*M) - (1.0*M);
      uv.x *= AR;
      
      vec3 Ds = normalize(vec3(uvMouse.x-((0.5*AR)), uvMouse.y-0.5, (joy_fov/-2.0)));
      
      vec3 O = vec3(0., joy_cameraheight, 0.);
      vec3 D = normalize(vec3(uv, -(joy_fov*M)));

      vec3 color = vec3(0.);
      vec3 scat = vec3(0.);
      vec3 oceanColor = vec3(0.);

      float att = 1.;
      float staratt = 1.;
      float scatatt = 1.;
      vec3 star = vec3(0.);
      vec4 aur = vec4(0.);

      float fade = smoothstep(0.,0.01,abs(D.y))*0.5+0.9;
      
      staratt = 1. -min(1.0,(uvMouse.y*2.0));
      scatatt = 1. -min(1.0,(uvMouse.y*2.2));

      if (D.y < -joy_ts) {
          float L = - O.y / D.y;
          vec3 hit = O + D * L;
          O = hit;

          vec3 Nw = joy_waterNormal(hit.xz, u_time * u_speed);
          D = reflect(D, Nw);
          D = normalize(mix(D, normalize(vec3(D.x, abs(D.y), D.z)), 0.2));

          // Subtle micro ripple keeps motion smooth without visible jitter
          D = normalize(D + vec3(0.0, 0.0009 * sin((u_time * u_speed) * 0.8 + joy_noise2(hit.xz * 0.002) * 6.2831), 0.0));
          att = .6;

          float fres = pow(1.0 - clamp(dot(-D, Nw), 0.0, 1.0), 4.0);
          vec3 deepWater = vec3(0.02, 0.06, 0.11);
          vec3 shallowWater = vec3(0.06, 0.14, 0.2);
          vec3 baseWater = mix(deepWater, shallowWater, 0.35 + 0.25 * joy_noise2(hit.xz * 0.0015));
          vec3 sunSpec = vec3(1.0, 0.9, 0.75) * pow(max(dot(reflect(-Ds, Nw), -D), 0.0), 72.0) * 0.95;
          oceanColor = baseWater * (1.0 - fres) + sunSpec + fres * vec3(0.2, 0.28, 0.36);

          star = joy_stars(D);
          if (uvMouse.y < 0.5) aur = smoothstep(0.0,2.5,joy_aurora(O,D));
      } else {
          float L1 =  O.y / D.y;
          vec3 O1 = O + D * L1;
          vec3 D1 = normalize(D + vec3(0.75, 0.0006 * sin((u_time * u_speed) * 0.75 + 6.2831 * joy_noise2(O1.xz * 0.0018 + vec2(0., (u_time * u_speed) * 0.4))), 0.));
          star = joy_stars(D1);
          if (uvMouse.y < 0.5) aur = smoothstep(0.,1.5,joy_aurora(O,D))*fade;
      }

      // Soften the reflection/sky branch boundary to avoid a visible center seam line.
      float horizonBand = 1.0 - smoothstep(0.0, 0.028, abs(D.y + joy_ts));
      vec3 horizonTint = vec3(0.05, 0.08, 0.12) * horizonBand * 0.7;

      star *= att;
      star *= staratt;

      joy_scatter(O, D, color, scat, u_time * u_speed, Ds);
      color *= att;
      scat *=  att;
      scat *= scatatt;
      
      color += scat;
      color += star;
      color += aur.rgb*scatatt;
      color += horizonTint;
      color = mix(color, color + oceanColor, 0.55);

      return pow(color, vec3(1.0/2.2));
  }
  // --- End Joy Mode Shader Functions ---

  // --- Drift Mode Shader Functions ---
  const float drift_FLIGHT_SPEED = 8.0;
  const float drift_DRAW_DISTANCE = 60.0;
  const float drift_FADEOUT_DISTANCE = 10.0;
  const float drift_FIELD_OF_VIEW = 1.05;
  const float drift_STAR_SIZE = 0.42;
  const float drift_STAR_CORE_SIZE = 0.1;
  const float drift_CLUSTER_SCALE = 0.02;
  const float drift_STAR_THRESHOLD = 0.91;
  const float drift_BLACK_HOLE_CORE_RADIUS = 0.2;
  const float drift_BLACK_HOLE_THRESHOLD = 0.9995;
  const float drift_BLACK_HOLE_DISTORTION = 0.03;

  float drift_noise(vec2 x) {
      return hash(x);
  }

  bool drift_hasStar(ivec3 chunk) {
      return drift_noise(mod(drift_CLUSTER_SCALE * (vec2(chunk.xy) + vec2(chunk.zx)) + vec2(0.724, 0.111), 1.0)) > drift_STAR_THRESHOLD
          && drift_noise(mod(drift_CLUSTER_SCALE * (vec2(chunk.xz) + vec2(chunk.zy)) + vec2(0.333, 0.777), 1.0)) > drift_STAR_THRESHOLD;
  }

  vec3 drift_getStarColor(ivec3 chunk) {
      float colorNoise = drift_noise(mod(drift_CLUSTER_SCALE * vec2(chunk.xy) + vec2(0.88, 0.22), 1.0));
      return 0.7 + 0.3 * cos(colorNoise * 6.28318 + vec3(0.0, 2.09439, 4.18879)); // RGB phase shift
  }

  vec3 renderDrift(vec2 fragCoord) {
      vec2 uv = fragCoord.xy / u_resolution.xy;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;
      
      float t = u_time * u_speed;
      
      vec3 cameraPos = vec3(0.0, 0.0, t * drift_FLIGHT_SPEED);
      vec3 rayDir = normalize(vec3(p, drift_FIELD_OF_VIEW));
      
      vec3 color = vec3(0.0);
      
      // Raymarching through chunks
      vec3 currentPos = cameraPos;
      ivec3 currentChunk = ivec3(floor(currentPos));
      
      vec3 stepDir = sign(rayDir);
      vec3 tDelta = abs(1.0 / rayDir);
      vec3 tMax = (sign(rayDir) * (vec3(currentChunk) - currentPos) + (sign(rayDir) * 0.5) + 0.5) * tDelta;
      
      float distanceTraveled = 0.0;
      
      for (int i = 0; i < 150; i++) {
          if (distanceTraveled > drift_DRAW_DISTANCE) break;
          
          if (drift_hasStar(currentChunk)) {
              vec3 starCenter = vec3(currentChunk) + 0.5;
              
              // Black hole logic
              float isBlackHole = step(drift_BLACK_HOLE_THRESHOLD, drift_noise(mod(drift_CLUSTER_SCALE * vec2(currentChunk.xy), 1.0)));
              
              vec3 toStar = starCenter - cameraPos;
              float distToStar = length(toStar - dot(toStar, rayDir) * rayDir); // Distance from ray to star center
              
              if (isBlackHole > 0.5) {
                  // Black hole distortion
                  if (distToStar < drift_BLACK_HOLE_CORE_RADIUS) {
                      color = vec3(0.0); // Event horizon
                      break;
                  } else {
                      // Accretion disk / distortion (simplified)
                      float distortion = drift_BLACK_HOLE_DISTORTION / distToStar;
                      rayDir = normalize(rayDir + toStar * distortion);
                      // Recalculate raymarching parameters
                      stepDir = sign(rayDir);
                      tDelta = abs(1.0 / rayDir);
                      tMax = (sign(rayDir) * (vec3(currentChunk) - currentPos) + (sign(rayDir) * 0.5) + 0.5) * tDelta;
                  }
              } else {
                  // Normal star
                  if (distToStar < drift_STAR_SIZE) {
                      float intensity = 1.0 - (distToStar / drift_STAR_SIZE);
                      intensity = pow(intensity, 2.0); // Softer edges
                      
                      // Core brightness
                      float core = smoothstep(drift_STAR_CORE_SIZE, 0.0, distToStar);
                      
                      vec3 starColor = drift_getStarColor(currentChunk);
                      
                      // Fade out in distance
                      float fade = 1.0 - smoothstep(drift_DRAW_DISTANCE - drift_FADEOUT_DISTANCE, drift_DRAW_DISTANCE, distanceTraveled);
                      
                      float glow = smoothstep(drift_STAR_SIZE, 0.0, distToStar) * 0.22;
                      vec3 dreamyTint = vec3(0.78, 0.84, 1.0);
                      color += ((starColor * dreamyTint) * intensity * 0.58 + core * 0.42 + glow) * fade;
                  }
              }
          }
          
          // Advance to next chunk
          if (tMax.x < tMax.y) {
              if (tMax.x < tMax.z) {
                  currentChunk.x += int(stepDir.x);
                  distanceTraveled = tMax.x;
                  tMax.x += tDelta.x;
              } else {
                  currentChunk.z += int(stepDir.z);
                  distanceTraveled = tMax.z;
                  tMax.z += tDelta.z;
              }
          } else {
              if (tMax.y < tMax.z) {
                  currentChunk.y += int(stepDir.y);
                  distanceTraveled = tMax.y;
                  tMax.y += tDelta.y;
              } else {
                  currentChunk.z += int(stepDir.z);
                  distanceTraveled = tMax.z;
                  tMax.z += tDelta.z;
              }
          }
          currentPos = cameraPos + rayDir * distanceTraveled;
      }
      
      // Background nebula/glow
      vec2 bgUv = p * 0.5;
      float bgNoise = fbm(bgUv + t * 0.045);
      vec3 bgColor = vec3(0.03, 0.06, 0.13) * bgNoise * 0.72;
      vec3 dreamyNebula = vec3(0.05, 0.04, 0.09) * pow(max(bgNoise, 0.0), 1.6) * 0.45;
      color += bgColor;
      color += dreamyNebula;
      color = mix(color, color * vec3(0.95, 0.98, 1.05), 0.25);
      
      return color;
  }
  // --- End Drift Mode Shader Functions ---

  vec3 getModeColor(int mode, vec2 fragCoord) {
      vec3 color = vec3(0.0);
      if (mode == 0) color = renderDown(fragCoord);
      else if (mode == 1) color = renderJoy(fragCoord);
      else color = renderDrift(fragCoord);
      
      vec2 uv = fragCoord.xy / u_resolution.xy;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;
      
      // Vignette
      float vignette = 1.0;
      if (mode == 1) {
        // Joy mode: reduced vignette to keep it bright
        vignette = 1.0 - 0.4 * smoothstep(0.8, 2.5, length(p));
      } else {
        // Down and Drift modes: keep mood, but reduce oppressive darkness
        vignette = 1.0 - 0.65 * smoothstep(0.45, 2.0, length(p));
      }
      color *= vignette;

      // Lift gamma/brightness for Down and Drift for better readability and calmer tone
      if (mode == 0) {
        color = pow(max(color, vec3(0.0)), vec3(0.92));
        color *= 1.12;
      } else if (mode == 2) {
        color = pow(max(color, vec3(0.0)), vec3(0.9));
        color *= 1.18;
      }
      
      return color;
  }

  void main() {
      // Render current mode only to avoid any previous-mode residual artifacts.
      vec3 colorCurrent = getModeColor(u_mode, gl_FragCoord.xy);
      fragColor = vec4(colorCurrent, 1.0);
  }
`;

function createShader(gl: WebGL2RenderingContext | WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext | WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

interface ShaderBackgroundProps {
  mode: 'Down' | 'Joy' | 'Drift';
  speed: number;
}

export default function ShaderBackground({ mode, speed }: ShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentMode, setCurrentMode] = useState(mode);

  useEffect(() => {
    if (mode !== currentMode) {
      setCurrentMode(mode);
    }
  }, [mode, currentMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const positionAttributeLocation = gl.getAttribLocation(program, 'position');
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    const image = new Image();
    image.crossOrigin = "anonymous";
    // A nice colorful city night bokeh image for the rain effect
    image.src = "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=1024&auto=format&fit=crop"; 
    image.onload = () => {
      const canvas2d = document.createElement('canvas');
      canvas2d.width = 1024;
      canvas2d.height = 1024;
      const ctx = canvas2d.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0, 1024, 1024);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // Avoid visible wrap seams (horizontal/vertical lines) from non-tileable source images.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    };

    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const modeUniformLocation = gl.getUniformLocation(program, 'u_mode');
    const speedUniformLocation = gl.getUniformLocation(program, 'u_speed');
    const iChannel0UniformLocation = gl.getUniformLocation(program, 'iChannel0');

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resize);
    resize();

    const render = (time: number) => {
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.uniform1f(timeUniformLocation, (time - startTime) * 0.001);
      
      let modeInt = 0;
      if (currentMode === 'Down') modeInt = 0;
      else if (currentMode === 'Joy') modeInt = 1;
      else if (currentMode === 'Drift') modeInt = 2;
      gl.uniform1i(modeUniformLocation, modeInt);
      
      gl.uniform1f(speedUniformLocation, speed);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(iChannel0UniformLocation, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [currentMode, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
    />
  );
}
