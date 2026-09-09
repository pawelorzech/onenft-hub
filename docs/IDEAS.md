# Zaparkowane pomysły — rodzina onenft

Last verified: 2026-09-08 | 2026-09-08

## floor — rynek stojących ofert ze skarbcem dla holderów (wzór: flooor.fun)

Status: **zaparkowany 2026-09-08** (decyzja Pawła). Wracamy, gdy `one` albo `faces` zbiorą realnych holderów; przy kilku tokenach na kolekcję skarbiec byłby pyłem, a rynek martwy.

Wzór: https://flooor.fun/ (Base, open source: https://github.com/omgbbqhaxx/flooor, docs: https://vrnouns.gitbook.io/flooor/documentation/documentation-en). To nie kolekcja, tylko warstwa rynkowa nad obcymi ERC-721.

Mechanika do skopiowania:
- Jedna stojąca oferta na kolekcję (min. 0.03 ETH), ETH w escrow, przebicie zwraca automatycznie. Holder sprzedaje po stojącej cenie jednym klikiem po `setApprovalForAll`. Zero listingów.
- 5 % z każdej sprzedaży do dziennego skarbca. Holder „podpisuje" każdym NFT w oknie 16 h, claim w kolejnych 8 h; skarbiec dzieli się po równo na podpisane NFT.

Jak to wdrożyć u nas, gdy przyjdzie czas:
- Szósty repo `onenft/floor` + wpis w `hub/src/collections.ts` + subdomena `floor.onenft.click`. Osobny kontrakt rynku, żadnej zmiany w wdrożonych kontraktach.
- **Nie ruszać knot / blit / chainrun**: zapisana decyzja „no price, no royalties, not an investment" (ERC-2981 odrzucone). Ewentualnie tylko `one` i `faces`, które już mają ekonomię.
- Skarbiec z yieldem od cudzych sprzedaży podważa „not an investment"; potrzebny risk statement w stylu `one` (`RISK` w jednym stringu).

## bid — codzienna aukcja klasycznego Nouna (aktywny kierunek)

Status: **wybrane 2026-09-09** (decyzja Pawła). Pełny plan: `~/Programowanie/onenft/bid/PLAN.md`, README: `~/Programowanie/onenft/bid/README.md`. Nowa szósta kolekcja, repo `onenft-bid`, wpięcie w hub jak siostry (`kind: daily`).

Kluczowe decyzje Pawła (podjęte, nie do odgrzebania bez jego zgody):
- **Klasyczny wektorowy Noun zamiast pixel-Noun** — pierwszy nie-pikselowy w rodzinie, maksymalna rozpoznawalność Nouns. Nie-affiliacja przy blit/chainrun jest wzorcem.
- **24h aukcja na template Nouns Builder** (`Auction.sol`): reserve, anti-snipe buffer, settlement permissionless, `nonReentrant`, refundy push z WETH fallbackiem. Jedno rozliczenie dziennie, tak żeby zegar rodziny (midnight UTC) został zegarem.
- **Co 10. dzień (do 1000) mint prosto do treasury, bez aukcji** — puli prezentów dla nowych ludzi.
- **Sierota**: dzień bez licytanta powyżej reserve → claim za 0.001 ETH tylko dla holderów dowolnego innego tokena onenft (knot/blit/chainrun/faces/one), raz na wallet dziennie.
- **Retro-airdrop na starcie**: snapshot holderów wszystkich pięciu kolekcji → każdy dostaje jednego Nouna z treasury. Bez bid-ticketów, bez kamieni milowych, bez loterii 1/1 (zaparkowane).
- **Farcaster + frames** jako kanał virality (announcer X off — kosztuje; ręczne tweetowanie tylko przez Pawła). Frame przy każdym settle: „kto wygrał, ile, licytuj jutrzejszy".
- **Odrzucone w tej rundzie**: ticket z bida, nagrody-milowe, loteria 1/1, fundraisingowa aukcja founding.
- **JDG**: primary-sale ETH = przychód ryczałtowy (jak reszta rodziny); treasury oddzielny portfel.

Nowości kontraktowe względem sióstr (wszystko w `BidNounToken.sol`): `contractURI()` on-chain, `ERC-721Enumerable`, `ERC-4906 MetadataUpdate` przy settle, `treasuryBPS` (creator cut ~2,5%) — bez dotykania `OneNFT.sol` w knot/blit/chainrun/faces/one.

