# Microsoft Bulgarian voices

Govori plays natural Microsoft voices (Kalina and Borislav) for every Bulgarian word, phrase and conversation line. The clips are made once by a GitHub Action and saved in `public/voices`, so the app works offline and the voice is the same on every phone. If a clip is missing, the app uses the iPhone's Bulgarian voice instead. Your wife's own recordings always come first.

## One-time setup (about 10 minutes)

1. Sign in at https://portal.azure.com (a free Microsoft account works; Azure may ask for a card to verify you, the free tier is not charged).
2. Click **Create a resource**, search for **Speech**, and create a **Speech** service:
   - Region: **West Europe** (or any region near you; note its short name, e.g. `westeurope`)
   - Pricing tier: **Free F0** (0.5 million characters a month; Govori needs about 25,000 once)
3. Open the new resource, go to **Keys and Endpoint**, and copy **Key 1** and the **Location/Region**.
4. In GitHub, add the key as a secret: https://github.com/Wasim-Dilov/govori/settings/secrets/actions/new
   - Name: `AZURE_SPEECH_KEY`, value: Key 1
5. Add the region as a variable: https://github.com/Wasim-Dilov/govori/settings/variables/actions/new
   - Name: `AZURE_SPEECH_REGION`, value: e.g. `westeurope`
6. Run it once: https://github.com/Wasim-Dilov/govori/actions/workflows/voices.yml, then **Run workflow**.

The first run makes about 1,700 clips. On the free tier Microsoft may slow it down; the job waits politely, saves progress every 250 clips and redeploys the site when it finishes. After that it only makes clips for new or changed content, automatically whenever the lessons change.

## On the phone

Open Me > Sound: it shows "Voice: Kalina (Microsoft)" and a **Save all audio for offline** button, so every clip is on the phone before a flight.

## Voices used

- Words, phrases, letters and your wife in conversations: Kalina.
- Your own lines in conversations: Borislav, or Kalina if Govori addresses you as a woman.
- Kids: Kalina with a higher pitch. Тъща and баба: Kalina, slower and lower. Тъст: Borislav, slower and lower. Waiters and friends: Borislav.
