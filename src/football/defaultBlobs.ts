/**
 * IS blobs padrão para o mapa de football padrão do bonk.io.
 *
 * O IS blob codifica o estado inicial da engine de física (posições de spawn
 * dos bro bodies). Estes blobs foram capturados do mapa football padrão e
 * funcionam para qualquer sala que use esse mapa sem customização.
 *
 * Chave = número de jogadores ATIVOS (excluindo o bot no spec):
 *   "1"  → solo (bot + 1 jogador)        — 2 bodies
 *   "2"  → 1v1  (bot + 1 red + 1 blue)   — 3 bodies
 *   "4"  → 2v2  (bot + 2 red + 2 blue)   — 5 bodies
 *
 * Para mapas customizados, capture o blob com:
 *   npx @bonktools/core capture-is <URL_DA_SALA>
 */
export const FOOTBALL_DEFAULT_BLOBS: Record<string, string> = {
  '1': 'jWcWiGhaqGDGCGkWeygybsaBaXGEIWuqefJIafaDWgKaTajLcxXaWemb1aeWhSoOaNcgfPOaBLGc2ajwWzjxDNd5jXanqbEwCGibIbUROlZZ8touXqsARhBplAVmwIAMhF36pMuQqWqNljLbiDlhcagDUUCBIEIS01AAM1ACKABIxcfEcAGYI5IRZ5PhIKYhYAOZphEEADhAF+ACa4toAzkikDfg4hNoALGEAHhzDcNraGPFQhN3admEA7Hxcyy0ArqsI1NOEaL0cZZCEMBi0hBQpWADiAyAApmwqAJ64WADCEB2v3WjVWy5QKWkDTY8Uu3UkamoDwA1mFSEk4N0VNCWAANUp4d4dME9fphcQASwJjwAbGTXpJtrMFksVutNttdvtDsdThR8BxLiookloq82AAXaoNWgCgDKUO00NuWUqKDg8VwABUYjA0AhiABeTVAA',
  '2': 'jWcWiGhaqGDGCGkWeygybsaBaXGEIWuqefJIafaDWgKaTajLcxXaWemb1aeWhSoOaNcgfPOaBLGc2ajwWzjxDNd5jXanqbEwCGibIbUROlZZ8touXqsARhBplAVmwIAMhF36pMuQqWqNljLbiDlhcagDUUCBIEIS01AAM1ACKABIxcfEcAGYI5IRZ5PhIKYhYAOZphEEADhAF+ACa4toAzkikDfg4hNoALGEAHhzDcNraGPFQhN3admEA7Hxcyy0ArqsI1NOEaL0cZZCEMBi0hBQpWADiAyAApmwqAJ64WJAdAMLdaNVbLlAp0gabHil2AZRcVQwAGsoBR8BxLiookkACrQEoYahsFG9ECEP5sSTVLC0OBqYDkChg6KEAAaCHmADYWJQnE4+Es0PhDrSYPN1gBLIWPRmMuBQw4wECnCjvW60hrbSSJNjaAAuUBE5DQLFoGAQLEsmCBkjsdQalxm-RQKMkduGwHwau2swWSxW602212+0lJzOhQRSKQqIg7zYauqDVoaoAyljtFDbllKig4PFcGijmgEMQALx5oA',
  '4': 'jWcWiGhaqGDGCGkWeygybsaBaXGEIWuqefJIafaDWgKaTajLcxXaWemb1aeWhSoOaNcgfPOaBLGc2ajwWzjxDNd5jXanqbEwCGibIbUROlZZ8touXqsARhBplAVmwIAMhF36pMuQqWqNljLbiDlhcagDUUCBIEIS01AAM1ACKABIxcfEcAGYI5IRZ5PhIKYhYAOZphEEADhAF+ACa4toAzkikDfg4hNoALGEAHhzDcNraGPFQhN3admEA7Hxcyy0ArqsI1NOEaL0cZZCEMBi0hBQpWADiAyAApmwqAJ64WNrAZS5VGADWZ4UclxUUSSTlOInIAGF2EkId1JIk2NoAC5QEQNWE7apbAAq0BS0gabHi+Hen3EP1R-0BwKQYMh0IAknCEcioBR8FhaCoMNRSABLR6U7TUS4YNQNFCkFBQLJCSlQW6kETVFbrVZlb5JCgKrKrABsesolCcTiWtC1kNuKQa2zQdn2kCg+IwhPil26GD43gAqqoQNQUjABu9ooQABoIeYcUZjSwoeIAZXihzDMHm6z5mceBrg30OMBApwoENuYZtzOoiJRFDQLFoGAQLEsmEJkjsdQa7p6-TC4izBr1EMk21mYV7-YNELstr2BxixyLVKBSCS0QhbCR1QatCRCcr2m+tyyKVo8sVSPi8W93rDYaykicFoV2LU88LfxLZe28P31fItfrRtmxdNg2zqcgwCwFBJDUYBiwkABZQggA',
};

/**
 * Retorna o IS blob padrão para o número de jogadores ativos informado.
 * Retorna `undefined` se não há blob padrão para aquela configuração
 * (ex: 3 jogadores, que é configuração assimétrica).
 */
export function getFootballDefaultBlob(activePlayers: number): string | undefined {
  return FOOTBALL_DEFAULT_BLOBS[String(activePlayers)];
}
