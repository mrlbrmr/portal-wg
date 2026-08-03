export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(.)\1{10}$/.test(d)) return false;

  const verifier = (end: number): number => {
    let sum = 0;
    for (let i = 0; i < end; i++) sum += Number(d[i]) * (end + 1 - i);
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return verifier(9) === Number(d[9]) && verifier(10) === Number(d[10]);
}
