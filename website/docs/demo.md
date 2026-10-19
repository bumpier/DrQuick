# Investor demo: the presenter's guide

You run the demo from a web browser. You do not need a terminal.

You need:

- A laptop with a working camera and microphone, on a good connection.
- Chrome.
- The web address, https://demo.drquick.co.uk, and the passcode. The developer gives you the passcode privately: keep it private, and do not write it in a shared document, a calendar invite or a chat with the investors.

## Before the meeting

Do one full private run, through every step of the run sheet below, on the laptop you will present from. The first sign-in and the first call are a little slower once.

1. Open https://demo.drquick.co.uk in Chrome.
2. Enter the passcode and press **Enter demo**. You land on the presenter page, headed **Demo**: everything starts from there. You stay signed in for 12 hours. If you ever find yourself somewhere else, the presenter page's address is https://demo.drquick.co.uk/dev/demo (bookmark it).
3. Press **Reset**, and confirm. Do this every time before you start a run. Each Reset signs the doctor out and ends anything live.
4. Open the three windows from the presenter page: **Website**, **Patient app**, **Doctor portal**. Each opens as a new tab. Drag the **Doctor portal** tab out of the tab strip into a window of its own, and put it beside the patient's. A doctor tab you are not looking at counts as hidden, and a hidden doctor window loses its offer after 15 seconds.
5. The website asks about cookies once, in a bar at the bottom: press **Decline** (**Accept analytics** works too). It does not ask again in this browser. The patient app and the doctor portal never ask.
6. Chrome asks to use the camera and the microphone in the doctor window when you press **Start video** (not before): choose **Allow**. The patient window asks for neither.
7. Headphones are not needed: the patient side sends no sound.

## Run sheet

1. **Reset** on the presenter page.
2. **Website:** the GP page, then switch to Patients.
3. **Patient app:** See a GP now, through to Request a GP.
4. **Doctor portal:** sign in (the form is prefilled), then Go online. The offer appears at once.
5. **Doctor:** Accept.
6. **Patient:** Join the call.
7. **Doctor:** Start video. Both sides show the lock.
8. **Doctor:** Complete consultation. The patient sees the outcome.
9. **Doctor:** Earnings.

Book as the patient before the doctor goes online. The doctor window is hidden while you book, and a doctor who has been silent for two minutes is taken offline. Accept the offer before you switch away from the doctor window: a hidden doctor window loses the offer after 15 seconds.

The presenter page shows where the doctor is (offline, online, offer showing, in a consultation, finished).

## If something goes wrong

- **The passcode page says too many attempts.** Wait ten minutes, then type the passcode carefully.
- **The passcode is refused, or you are sent back to it.** Check you typed it as given. If it was changed since, ask for the new one.
- **A page says "Demo not configured".** The demo is switched off or broken on the server. Contact the developer; you cannot fix this yourself.
- **The passcode page says "The demo is unavailable right now. Try again shortly."** Try once more; if it stays, contact the developer.
- **Missed offer (45 seconds).** The patient lands on "No GP available" and nobody is lost. The doctor taps **Back online**, then the patient taps **Try again**.
- **Declined offer.** The doctor stays online. The patient taps **Try again**.
- **The video does not start.** Check Chrome allowed the camera and the microphone for the doctor window (the camera icon in the address bar), then press **Start video** again.
- **You are on the website, or a page you do not recognise.** Go to https://demo.drquick.co.uk/dev/demo, the presenter page.
- **Anything else stuck.** Press **Reset** on the presenter page, close the patient and doctor windows, open them again from the presenter page, and start from step 2 of the run sheet. Reset also ends a live call. Never reload the patient window in the middle of a booking.
- **A page loads slowly or looks broken.** Reload it once. If it stays broken, call the developer.

## When you have finished

Press **Sign out of the demo** at the bottom of the presenter page. It returns you to the passcode page. Do this on any laptop that is not yours.

## If asked why there is no fixed price

Demand sets the price. The patient sees the full price before they book, and it never changes after that. Doctors are paid more when demand is high. Never say a fixed figure aloud; none is shown anywhere.

## Known limits

- The prototype ribbon stays on the patient screens.
- The picture the doctor sees of the patient is a generated illustration, not a live camera.
- Everything is demo data, and Reset wipes it. Do not type real names or health details.
- The demo is a separate copy of the site. The public site, drquick.co.uk, is unaffected by anything you do here.

## For the developer

Setting up the live copy (DNS, Caddy, the database, the passcode): `docs/demo-deploy.md`.

To run the demo on your own machine instead: stop any other dev server (port 3100 must be free), make sure `.env.local` holds `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CALL_KEY_SECRET` and `DOCTOR_SESSION_SECRET` (without the first four the call cannot start; without the last nobody can sign in to the doctor portal), then from the `website` folder run `npm run demo`. Wait for `Demo ready: http://localhost:3100/dev/demo` and open that link. On a developer's machine the demo answers loopback requests only and there is no passcode. The run sheet is also on the presenter page (`app/dev/demo/DemoControls.tsx`); keep the two in step.
