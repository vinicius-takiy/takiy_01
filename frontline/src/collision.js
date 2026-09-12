// Colisão analítica contra AABBs. Nada de Raycaster do three aqui: o mundo é uma
// lista de caixas, e testar caixa a caixa é mais barato e mais previsível do que
// varrer a árvore de malhas a cada tiro e a cada checagem de linha de visão.

/** Empurra um círculo (o jogador, visto de cima) para fora das caixas. */
export function resolverCirculo(pos, raio, caixas, alturaOlho) {
  for (const c of caixas) {
    if (alturaOlho > c.maxY + 0.05) continue;           // dá pra passar por cima
    const px = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const pz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - px;
    const dz = pos.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= raio * raio) continue;

    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = px + (dx / d) * raio;
      pos.z = pz + (dz / d) * raio;
    } else {
      // centro dentro da caixa: sai pela face mais próxima
      const saidas = [
        [c.minX - raio - pos.x, 0], [c.maxX + raio - pos.x, 0],
        [0, c.minZ - raio - pos.z], [0, c.maxZ + raio - pos.z],
      ].sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))[0];
      pos.x += saidas[0];
      pos.z += saidas[1];
    }
  }
}

/** Distância até uma AABB ao longo de um raio, ou Infinity. Método dos slabs. */
export function raioVsCaixa(o, d, c) {
  let t0 = 0, t1 = Infinity;
  for (const [oi, di, mn, mx] of [
    [o.x, d.x, c.minX, c.maxX], [o.y, d.y, c.minY, c.maxY], [o.z, d.z, c.minZ, c.maxZ],
  ]) {
    if (Math.abs(di) < 1e-8) { if (oi < mn || oi > mx) return Infinity; continue; }
    let a = (mn - oi) / di, b = (mx - oi) / di;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Primeira caixa atingida dentro do alcance. */
export function raioVsMundo(o, d, caixas, alcance) {
  let melhor = alcance;
  for (const c of caixas) {
    const t = raioVsCaixa(o, d, c);
    if (t < melhor) melhor = t;
  }
  return melhor;
}

/** Distância até uma esfera ao longo de um raio, ou Infinity. */
export function raioVsEsfera(o, d, centro, raio) {
  const ox = o.x - centro.x, oy = o.y - centro.y, oz = o.z - centro.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - raio * raio;
  if (c > 0 && b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? Infinity : t;
}

/** Há parede entre os dois pontos? Usado para linha de visão dos inimigos. */
export function bloqueado(a, b, caixas) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return false;
  const d = { x: dx / dist, y: dy / dist, z: dz / dist };
  return raioVsMundo(a, d, caixas, dist) < dist - 0.05;
}
