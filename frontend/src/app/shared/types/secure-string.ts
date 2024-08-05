export type SecureString = {
  value: string;
};

export function isSecureString(
  obj: string | SecureString,
): obj is SecureString {
  return (
    !(typeof obj === 'string') && (obj as SecureString).value !== undefined
  );
}
