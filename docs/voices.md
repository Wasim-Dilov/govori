# Natural Bulgarian voices

Govori can play a natural voice for every Bulgarian word, phrase and conversation line. A GitHub Action makes the clips once and saves them in `public/voices`, so the app works offline and sounds the same on every phone. If a clip is missing, the app uses the iPhone's Bulgarian voice instead. Your wife's own recordings always come first.

Two providers are supported: **ElevenLabs** (recommended: easy sign-up, very natural voices) and **Microsoft Azure**.

## ElevenLabs setup (about 10 minutes)

### 1. Create an API key
1. Sign up or sign in at https://elevenlabs.io (email or Google login).
2. In the left sidebar open **Developers**, then **API Keys** (or go straight to https://elevenlabs.io/app/settings/api-keys).
3. Click **Create API Key**, name it `Govori`, and give it only these permissions:
   - **Text to Speech**: access
   - **Voices**: read and write (write lets the workflow add a library voice to your account)
   - **User**: read (to check how many characters are left this month)
4. Leave expiry on **Never**, create it, and copy the key. It is shown only once.

### 2. Add it to GitHub
- Add a secret: https://github.com/Wasim-Dilov/govori/settings/secrets/actions/new
  - Name: `ELEVENLABS_API_KEY`, value: the key.
- Paste the key only into GitHub, never into a chat or a file.

### 3. The voices

The voices are already chosen and set as defaults in the workflow:
- **Milena**: words, phrases, letters, your wife and the other women in conversations.
- **Georgi**: your own lines and the men (waiters, friends, тъст).
- **Mimi**: the kids.

Тъща and баба use Milena, and тъст uses Georgi. The free plan has 3 voice slots, so the workflow adds these three to your account by itself and gives the elders their own voices only if you set `ELEVENLABS_VOICE_ELDER_F` / `ELEVENLABS_VOICE_ELDER_M` and a slot is free.

To try other voices later:
1. Open https://github.com/Wasim-Dilov/govori/actions/workflows/voices.yml, click **Run workflow**, choose mode **list**. The run summary lists Bulgarian voices with a **listen** link and their ids.
2. Run it with mode **sample** and the candidates in **sample_voices** (`public_owner_id:voice_id`, comma separated). The summary links each test sentence, and the `voice-samples` branch has a player page.
3. Set the repository variables `ELEVENLABS_VOICE_F`, `ELEVENLABS_VOICE_M` or `ELEVENLABS_VOICE_KID` (https://github.com/Wasim-Dilov/govori/settings/variables/actions/new). Changing a voice makes fresh clips for it.

### 4. Voice the app
Run the workflow with mode **full** (or just wait: it also runs when lessons change and on the 2nd of every month). It makes the clips in learning order, commits them and redeploys the site.

### Characters and cost
- Govori needs about 23,000 characters to voice everything once.
- The **free plan** gives 10,000 characters a month. The run stops cleanly when the month's characters run out, and a monthly schedule (on the 2nd) carries on automatically, so everything is voiced over about three months. The free plan asks for attribution and is for non-commercial use, which fits a personal app.
- Clips are made in learning order, so each month's characters voice what you meet first: the alphabet words, then lessons in 12-week-plan order (Basics units 1 and 2, Love unit 1, Kids unit 1, then every track unit by unit), then conversations, then single words for the word tiles, and last the woman's forms (only needed if Govori addresses the learner as a woman). Anything not yet voiced uses the phone's voice.
- The **Starter plan** (about $5 for one month, cancel after) covers everything in one run.
- After that, only new or changed lessons use characters.

The default model is `eleven_v4` (1 credit per character); if the API does not offer it, the run switches to `eleven_multilingual_v2` by itself. To choose another model, set the variable `ELEVENLABS_MODEL` (changing the model or a voice makes fresh clips).

## Microsoft Azure (alternative)

1. In https://portal.azure.com create a **Speech** service: region **West Europe**, pricing tier **Free F0** (0.5 million characters a month).
2. Under **Keys and Endpoint** copy **Key 1** and the **Location/Region**.
3. Add the secret `AZURE_SPEECH_KEY` and the variable `AZURE_SPEECH_REGION` (for example `westeurope`) in GitHub.
4. Run the workflow with mode **full**.

Azure uses Kalina and Borislav, with a higher pitch for the kids and slower, lower voices for the in-laws. If both keys are set, ElevenLabs is used unless the variable `TTS_PROVIDER` is `azure`.

## On the phone

Open Me > Sound: it shows the voice (for example "Milena (ElevenLabs)"), how many clips are available and a **Save all audio for offline** button, so every clip is on the phone before a flight.

## Running it locally

```bash
ELEVENLABS_API_KEY=... node scripts/generate-voices.mjs --list-voices
```

```bash
ELEVENLABS_API_KEY=... SAMPLE_VOICES=owner:voice,owner:voice node scripts/generate-voices.mjs --sample
```

```bash
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_F=... ELEVENLABS_VOICE_M=... node scripts/generate-voices.mjs
```
