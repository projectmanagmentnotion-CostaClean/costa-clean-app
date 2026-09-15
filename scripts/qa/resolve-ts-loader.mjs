export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !specifier.endsWith('.js') && !specifier.endsWith('.mjs') && !specifier.endsWith('.cjs') && !specifier.endsWith('.ts')) {
    return nextResolve(`${specifier}.ts`, context, nextResolve)
  }

  return nextResolve(specifier, context, nextResolve)
}
