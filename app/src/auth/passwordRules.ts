/**
 * Regras de senha do cadastro.
 *
 * O mínimo do Supabase é 6 caracteres, mas uma conta que guarda histórico
 * emocional merece mais do que o mínimo. As exigências são explícitas e
 * checadas uma a uma para a tela poder mostrar o que ainda falta — em vez
 * de um "senha fraca" que não diz o que fazer.
 */

export type PasswordCheck = {
  id: string;
  label: string;
  passed: boolean;
};

export type PasswordStrength = {
  checks: PasswordCheck[];
  /** 0-4. Só conta as exigências obrigatórias. */
  score: number;
  /** Todas as obrigatórias atendidas. */
  valid: boolean;
  label: string;
  color: string;
};

/** Sequências óbvias que passariam nas regras mas não protegem nada. */
const COMMON = [
  '123456', '12345678', 'senha', 'password', 'qwerty', 'abc123',
  '111111', 'mellow', 'mellowpet', 'iloveyou', 'admin',
];

/**
 * Só reprova quando a senha É a palavra comum — não quando apenas a contém.
 *
 * Bloquear por `includes` reprovava "Mellow2026forte", que é uma senha
 * perfeitamente boa. O que importa é se sobra alguma coisa além da palavra
 * óbvia: "senha", "senha123" e "Senha!" são adivinháveis; "Mellow2026forte"
 * não é.
 */
function isObvious(lower: string): boolean {
  // Tira dígitos e pontuação das pontas — é onde as pessoas os colam.
  const core = lower.replace(/^[^a-zà-ÿ]+|[^a-zà-ÿ]+$/g, '');
  if (COMMON.includes(core)) return true;
  // Uma senha curta que carrega uma palavra óbvia também não protege.
  return lower.length <= 10 && COMMON.some((c) => lower.includes(c));
}

export function checkPassword(password: string): PasswordStrength {
  const value = password ?? '';
  const lower = value.toLowerCase();

  const checks: PasswordCheck[] = [
    { id: 'length', label: 'Pelo menos 8 caracteres', passed: value.length >= 8 },
    { id: 'letter', label: 'Uma letra', passed: /\p{L}/u.test(value) },
    { id: 'number', label: 'Um número', passed: /\d/.test(value) },
    {
      id: 'common',
      label: 'Não ser uma senha óbvia',
      passed: value.length > 0 && !isObvious(lower),
    },
  ];

  const score = checks.filter((c) => c.passed).length;
  const valid = checks.every((c) => c.passed);

  // Um bônus de comprimento distingue "aceitável" de "forte" sem virar mais
  // uma exigência: 12+ caracteres protegem mais que qualquer regra de tipo.
  const strong = valid && value.length >= 12;

  return {
    checks,
    score,
    valid,
    label: value.length === 0
      ? ''
      : strong
        ? 'Senha forte'
        : valid
          ? 'Senha boa'
          : score >= 2
            ? 'Senha fraca'
            : 'Senha muito fraca',
    color: strong ? '#00B894' : valid ? '#55B49A' : score >= 2 ? '#F59E0B' : '#EF4444',
  };
}

/** Mensagem para o campo de confirmação. `null` quando está tudo certo. */
export function confirmError(password: string, confirmation: string): string | null {
  if (!confirmation) return null;
  if (password !== confirmation) return 'As senhas não são iguais.';
  return null;
}
