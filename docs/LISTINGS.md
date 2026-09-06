# Listings and directories: where onenft.click is or should be

Last verified: 2026-09-07 | 2026-09-07

Form answers, ready to paste. Research notes of the same day: base/web PRs are dead (repo archived 2026-03), the Base App dropped the Farcaster mini-app spec on 2026-04-09 (register on dashboard.base.org instead), fullyonchain.xyz is not a directory (fullyonchain.art is), awesome-base is archived, OnChainChecker takes no submissions but scores every contract at a fixed URL.

Creator everywhere: **onenft.click**, X handle **@onenftclick**. Logo per collection = token 1, a stable URL:
knot https://knot.onenft.click/day/1-1024.png · blit https://blit.onenft.click/day/1-1024.png · chainrun https://chainrun.onenft.click/day/1-1024.png · faces https://faces.onenft.click/face/1-1024.png · one https://one.onenft.click/coin/1-1024.png (1024x1024 PNG; 192 px copies in scratchpad/icons/)

## 1. fullyonchain.art/suggest (one form per collection, chain = Base, creator = onenft.click, X = @onenftclick)

| Field | knot | blit | chainrun | faces | one |
|---|---|---|---|---|---|
| Project name | Knot (knot.onenft.click) | Blit (blit.onenft.click) | Chain Run (chainrun.onenft.click) | Faces (faces.onenft.click) | ONE (one.onenft.click) |
| Contract | 0xb3b83788b9E6ccCb2379c3445dEF0627cf45E783 | 0x27E85c52527D3955AF013664eb0AED799555588B | 0x748b55c3762FE2a697DC268eD19743e22481Bb58 | 0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c | 0x7A7dea7489708cc9b50831C364aCf6e95aA13b41 |
| 1-of-1 | no | no | no | no (10,000 max, with a pool of 1/1s) | no |
| One sentence | One Truchet knot a day, drawn by the contract from the day number alone: sixteen palettes, ten traits, one SVG, no server. | One Blitmap remix a day: the composition of one CC0 Blitmap original with the palette of another, rendered on chain. | One Chain Runner a day, drawn on chain from the 338 CC0 Chain Runners layers with the original weight tables. | One face per wallet per UTC day, rolled on chain with commit and reveal from 32x32 sprites stored in the contract. | Pixel coins backed by USDC in a vault, art from a Chainlink VRF seed, rendered by the contract; the yield ring grows on chain. |
| Preview image | (logo URL above) | same | same | same | same |
| Feedback | OnChainChecker scores token 1 "Fully On-Chain" (5 of 5): https://onchainchecker.xyz/collection/base/<contract>/1. Code CC0: https://github.com/pawelorzech/<repo>. | | | | |

Repos: onenft, onenft-blit, onenft-chainrun, onenft-faces, onenft-one (all under github.com/pawelorzech).

## 2. base.org ecosystem form: https://forms.gle/hJhc2PqfAsQp86YL8
Submit from **2026-10-06** (30 days after knot's day 1). One entry for the family:
- Project Name: onenft.click
- URL: https://onenft.click
- Description (<200): Daily on-chain collections on Base. Knot, Blit and Chain Run mint one token a day from the day number; Faces rolls one face per wallet a day; ONE mints pixel coins backed by USDC. Every image is drawn by the contract. CC0.
- Logo URL: https://knot.onenft.click/day/1-1024.png
- Category: Consumer
Requirements they list: live 30 days (ok from 10-06), ToS + Privacy (now at /terms and /privacy on every site), HTTPS, no airdrop/TGE. Optional: one more entry per collection later, if the family entry gets in.

## 3. Base Dashboard (dashboard.base.org, login with the deployer or author wallet)
Register one app per collection; fields: name, icon (1024 PNG above), tagline (<30), description, screenshots (portrait phone shots of / and /how), category, primary URL, builder code.
- Knot: tagline "One knot a day, on chain" · category Art / NFT
- Blit: "One Blitmap remix a day"
- Chain Run: "One Chain Runner a day"
- Faces: "Roll one face a day" · category Art or Games
- ONE: "Pixel coins backed by USDC" · category Finance or NFT
Description = the one-sentence line from table 1 plus "Free to look, gas only to claim" (knot/blit/chainrun) or the fee sentence (faces) or the risk sentence (one).
The builder code the dashboard hands out should go into each site's mint transaction data (ERC-8021 suffix); that is a code change per repo, not part of this batch.

## 4. GitHub (done 2026-09-07)
Topics on all six repos: onchain-nft, generative-art, base, nft, solidity, cc0, bun. Homepage set to each site.

## 5. Optional PR: gianni-dalerta/awesome-nft
Line: `[onenft.click](https://onenft.click) - Daily fully on-chain collections on Base: one token a day from the day number, faces rolled per wallet, USDC-backed coins. CC0.`
