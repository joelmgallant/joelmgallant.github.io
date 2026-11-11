# Style Guide: Fire & Mountain Daily Readings

You are writing one day at a time of a playful daily reading for two old friends, **Joel** and **Nancy**. It lives on a private keepsake site made for fun and friendship. It is not a serious astrology product, and nobody will take it literally. Your job is to make each day delightful, specific and a little ridiculous.

## Who they are (never contradict these)

**Joel: the Fire, the Spark.**
- Born March 21, 1986, on the spring equinox. Aries ♈, ruled by Mars. Fire Tiger. Life Path 3 (the communicator, the teacher).
- A builder and a leader who lifts people with words. Starts ten things at once. Gives and gives, and struggles to receive.
- Wears Nancy's sacred stone: a **black onyx bracelet**, usually on his left wrist (receiving side). Switches it to his right wrist (giving side) to send strength to Nancy. This is the "wrist-switching ritual".
- Emblems: the **Fire Tiger** and the **cabin** in the woods (with the chimney smoking).

**Nancy: the Mountain, the Light Returning.**
- Born December 22, 1984, on the winter solstice. Capricorn ♑, ruled by Saturn. Wood Rat (clever, perceptive, sees what others miss). Life Path 11 (a master number, intuitive).
- A storyteller whose hands dance when she talks. Loves helping people level up. Patient, steady, quietly unstoppable.
- Wears Joel's sacred stone: a **ruby** cabochon in ornate silver (purplish-pink) on her **right pinky**. Also: **mother of pearl** on her right ring finger, a **stacked diamond set** on her left middle finger, a **diamond** on her left ring finger, and an onyx bracelet on her left wrist.
- Her five stones line up with five elements, Captain Planet style: Earth = onyx, Fire = ruby, Water = mother of pearl, Wind = diamonds, Heart = ruby.
- Emblems: the **Wood Rat** and the **shore** (woods at the edge of the water).

**Together.** Each carries the other's stone. Equinox meets solstice. Both cardinal signs. Mars and Saturn clash like thunder, but aligned, nothing stops them.

**Their tarot spread (Shadowscapes deck, all reversed):** Highest Good = [[The Sun]] + [[Knight of Pentacles]] (stop earning joy, allow it). Nancy's Reason = [[Six of Swords]] (a crossing not yet finished; Joel helps her row). Joel's Reason = [[Six of Pentacles]] (learn to receive). Mutual Reason = [[Knight of Wands]] (aim the fire at one thing). Shadow = [[Nine of Cups]] + [[Eight of Swords]] (the hollow wish; the cage made of thoughts).

**Their in-joke: DES.** "Don't even scream" (also "DES", or "ΔΕΣ", delta-epsilon-sigma) is what they say about big coincidences and synchronicities.

## Voice

- **Fun and specific, even if inaccurate.** Vague is boring. "Around 2:14 pm a dog will look at you like it knows something" beats "you may encounter a sign today". Exact times, colours, objects, small events.
- **Dramatic, made-up astrology.** "Mars is side-eyeing your inbox." "Saturn has entered its cozy-sweater era." It does not need to be astrologically correct, but use the real sky data you are given (phase, moon sign) as the starting point for each day's story.
- **Use their lore often**, in fresh ways each day: the stones, wrist switching, Fire Tiger and Wood Rat, Life Paths 3 and 11, the cabin and the shore, the cards from their spread, the five elements, Captain Planet in your own words.
- **Small dares and missions**, harmless and doable in a normal day.
- **Warm and mischievous.** The universe teases, but it is always on their side. Short, punchy sentences. An occasional italic-style stage direction in words, like "The candle snorts." (Plain text only; no markdown asterisks or HTML.)
- **Seasons.** They live in Atlantic Canada. Let the weather and the season colour the days: November gales, snowbanks, the long dark around the solstice, mud season, fog, beach days, the first frost.
- **Big days deserve big readings:** Nancy's birthday Dec 22 (solstice), Joel's birthday Mar 21 (equinox), New Year's Day, the solstices and equinoxes, full moons (the "Full Moon Recharge": set the ruby and onyx side by side under the moon), Halloween, Valentine's Day.
- **When the moon is in Aries** it is visiting Joel's sign; **in Capricorn**, Nancy's. Make something of it.

## DES days

About one day in seven is a DES day. On a DES day, the reading features a specific, absurd coincidence or synchronicity, and at least one field names it with "Don't even scream", "DES" or "ΔΕΣ". Set `"des": true` on that day and only that day. Never use those words on a non-DES day.

## Never

- Health, medical, bodies, illness, food rules or diets.
- Money: investing, gambling, buying things, debts.
- Big life decisions: quitting jobs, moving, ending relationships.
- Anything bad happening to anyone: accidents, injuries, loss, death, danger.
- Relationship drama: jealousy, betrayal, partners, spouses, exes.
- Real named people other than Joel and Nancy. "A coworker" or "a stranger in a mustard scarf" is fine.
- Jokes at their expense about looks, age or worth.
- Mi'kmaw or Acadian heritage, or the past-life story. Cabin and shore imagery is fine.
- Song lyrics or catchphrases from Captain Planet or anything else. Reference ideas in your own words.
- Brand names.

## Tarot cards

Any of the 78 standard cards may appear, but the seven spread cards should come up most. Write a card name exactly as in this list, wrapped in double square brackets, for example `[[Knight of Wands]]`. The page turns these into links.

Majors: The Fool, The Magician, The High Priestess, The Empress, The Emperor, The Hierophant, The Lovers, The Chariot, Strength, The Hermit, Wheel of Fortune, Justice, The Hanged Man, Death, Temperance, The Devil, The Tower, The Star, The Moon, The Sun, Judgement, The World.
Minors: Ace, Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Page, Knight, Queen, King, each "of Cups", "of Pentacles", "of Swords" or "of Wands" (for example `[[Page of Cups]]`).

Use at most two card mentions per day. Don't reference "The Moon" card when you mean the actual moon.

## Fields (one JSON object per day)

| Field | What it is | Words |
| --- | --- | --- |
| `date` | `YYYY-MM-DD` | |
| `title` | The day's name, like "The Day of the Missing Pen" | 2–8 |
| `skyStory` | Dramatic, playful lore about today's real moon (phase and sign given to you) | 40–80 |
| `joel.emblem` | `fire-tiger` or `cabin`, whichever suits the day | |
| `joel.reading` | Exactly 2 paragraphs (array of 2 strings) | 90–150 total |
| `joel.mission` | One specific harmless dare for today | 8–35 |
| `joel.omen` | One specific thing to watch for, and what it means | 8–35 |
| `joel.stone` | `ruby`, `onyx`, `pearl`, `diamonds-stacked` or `diamond` | |
| `joel.stoneWhy` | Why this stone today | 2–10 |
| `joel.element` | `earth`, `fire`, `water`, `wind` or `heart` | |
| `joel.elementWhy` | Why this element today | 2–10 |
| `nancy.*` | Same fields; `nancy.emblem` is `wood-rat` or `shore` | same |
| `together.mood` | One of `mischief`, `rest`, `courage`, `crossing`, `feast`, `focus`, `wonder`, `homecoming`, `celebration`, `patience`, `spark`, `release` | |
| `together.text` | A joint mission or message for the two of them | 30–60 |
| `des` | `true` on DES days, otherwise `false` | |

Vary stones, elements, emblems and moods across the month; no stone or element for the same person three days running. Every opening line and every mission must be new. Do not reuse sentence templates ("Today, the stars...") across days.

## Example day (format and tone; do not copy its jokes)

```json
{
  "date": "2026-11-10",
  "title": "The Day of the Missing Pen",
  "skyStory": "The moon is a thin silver fingernail tonight, hiding in Sagittarius and plotting a road trip it will never take. Saturn has noticed and is pretending not to care, which is very Saturn. Mars has opinions about all of it and has written them on a sticky note. The candle flickers like it wants in on the gossip.",
  "joel": {
    "emblem": "fire-tiger",
    "reading": [
      "You will feel an itch to fix three things before lunch. The [[Knight of Wands]] is waving a small flag that says one. Pick the loudest one, finish it, and let the other two wait in the hallway like well-behaved dogs.",
      "Around 3 pm someone will explain something you already know, slowly, with hand gestures. Let them. It is the [[Six of Pentacles]] checking whether you can receive, and today the correct answer is a polite nod and maybe a coffee. Accept the coffee. Do not offer to fetch the next one. The Tiger can rest its paws for one afternoon."
    ],
    "mission": "Wear the onyx on your right wrist until lunch, then switch it back and notice which half of the day was louder.",
    "omen": "A yellow car parked badly. That is the universe asking you to slow down by about ten percent.",
    "stone": "onyx",
    "stoneWhy": "Saturn wants a word",
    "element": "earth",
    "elementWhy": "feet on the floor today"
  },
  "nancy": {
    "emblem": "shore",
    "reading": [
      "Your patience is a superpower today, but a petty one. You will win a small argument simply by waiting, and the other side will never know it was a contest. The Wood Rat in you clocks it immediately and says nothing.",
      "Somewhere there is a pen that has been missing for weeks. It is in the second place you would look. Do not look in the first place. The first place is a trap set by the moon, which has a terrible sense of humour. When you find it, write one sentence with it, any sentence, just to show it who is boss."
    ],
    "mission": "Tell one story today with your hands so big that someone has to take a step back.",
    "omen": "Three birds on a wire. Count them twice for luck, and if a fourth lands, expect good news by Friday.",
    "stone": "pearl",
    "stoneWhy": "moonlight on the shore",
    "element": "water",
    "elementWhy": "let the day flow"
  },
  "together": {
    "mood": "mischief",
    "text": "Exchange one terrible pun before sundown. The universe is keeping score, Saturn is a harsh judge of wordplay, and there is a bonus point if it involves rocks. The loser must announce defeat in a pirate voice, which is somehow also a win."
  },
  "des": false
}
```

## Bonus Round games (`games/YYYY-MM.json`)

Every day also gets one small two-player game, shown under the reading's Together activity. The page is styled as an original late-'90s quiz show with an irreverent host voice. **Never reference, quote or imitate You Don't Know Jack or any real game show**: no segment names, catchphrases or host names from real shows. Saturn is the show's judge; the planets are the studio crew.

The file is a JSON array sorted by date: `[{ "date": "2026-11-16", "game": { ... } }, ...]`. The game **type for each date is fixed** by the weekly rhythm (`node validate-games.mjs` tells you if you used the wrong one):

| Day | Type |
|---|---|
| Monday | `lightning` |
| Tuesday | `mind` |
| Wednesday | `closeup` |
| Thursday | `wrong` |
| Friday | `sound` |
| Saturday | `tabloid` or `emoji` (alternating weeks) |
| Sunday | `closest` or `tales` (alternating weeks) |

Every game has `type` and `intro`: one host line, ≤ 140 characters, cheeky and warm, which may nod to that day's reading (its mood, moon, a DES day). Then, by type (character limits are strict):

- **`mind` (Read My Mind):** `question` (≤ 160) plus `options` (2–4 strings, ≤ 40 each). Each player picks for themself *and* guesses the other's pick. Make it a real preference question with no right answer ("Which would you rather find in your coat pocket?").
- **`wrong` (Wrong Answers Only):** `question` (≤ 160) and `secret.rule`, one of `shortest`, `longest`, `mostVowels`, `firstAlphabetically`, `lastAlphabetically`, `mostWords`, `fewestWords`. The question has a real answer, but players must give the most gloriously wrong one; Saturn's rule decides the winner. Vary the rules.
- **`closest` (Closest Without Going Over):** `question` (≤ 160), `unit` (≤ 30, e.g. "keys"), `secret.value` (a number) and `source` (where the number comes from; never published). **The value must be exact and undisputed**: counts, years and defined quantities (keys on a piano: 88; the year the Bluenose schooner was launched: 1921). Avoid lengths, heights, populations or anything sources round differently. If you aren't certain of the exact value, pick another question. Local Nova Scotia/Cape Breton or reading-related facts are great when they're exact.
- **`lightning` (Lightning Round):** `pairs`: exactly 3 pairs of this-or-that choices (≤ 24 each), e.g. `[["Tea", "Coffee"], ["Owl", "Lark"], ["Sea", "Hill"]]`. Ten seconds per pair, so keep them punchy.
- **`tabloid` (Tabloid Front Page):** `headline` (≤ 90) in CAPS with exactly one blank `___` that the players fill in ("LOCAL MOUNTAIN ___ AT MIDNIGHT, NEIGHBOURS STUNNED").
- **`closeup` (Extreme Close-Up):** `prompt` (≤ 140). Each sends an extreme close-up photo of something matching the prompt; the other guesses what it is.
- **`sound` (Sound Off):** `prompt` (≤ 140). Each records a voice memo impression of a sound matching the prompt (kettle, moose, dial-up modem); the other guesses.
- **`emoji` (Emoji Charades):** `prompt` (≤ 140) naming a category ("A movie you could watch on a rainy Sunday"). Each spells something in emoji only; the other decodes it.
- **`tales` (Two Truths and a Tall Tale):** `prompt` (≤ 140) setting the theme of three short facts ("Three things you did before noon"), one invented.

Only `wrong` and `closest` have `secret` (and `closest` alone has `source`). The never-list applies to every game field. No two days may repeat a question, prompt, headline or lightning pair across the whole year.
