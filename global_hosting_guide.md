# 🌍 Global Hosting & Sharing Guide

Right now, your backend is running locally on your computer. This means the app only works when your phone is on the **same WiFi** network as your PC. 

If you want **anyone** to be able to download your APK and use the app from anywhere in the world, you need to host your backend on the internet. Here is the step-by-step process.

---

## Part 1: Host the Backend (Free)

We will use **Render.com**, a popular and free hosting provider. The `musicapp` backend is already fully configured for Render (it has a `Procfile` ready to go).

1. **Push your code to GitHub** 
   - Create a new private repository on GitHub.
   - Commit and push your entire `musicapp` folder to that repository.
   
2. **Deploy on Render**
   - Go to [Render.com](https://render.com) and create a free account.
   - Click **New +** and select **Web Service**.
   - Connect your GitHub account and select your `musicapp` repository.
   - Use the following settings:
     - **Root Directory:** `backend`
     - **Environment:** `Python 3`
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** (Leave blank, it will automatically use your `Procfile`)
     - **Instance Type:** Free

3. **Add Environment Variables**
   - On the Render dashboard for your new service, go to **Environment**.
   - Add your Spotify API keys exactly as they are in your local `.env` file:
     - `SPOTIFY_CLIENT_ID` = `your_key_here`
     - `SPOTIFY_CLIENT_SECRET` = `your_secret_here`
   
4. **Get Your URL**
   - Once it finishes building, Render will give you a public URL (e.g., `https://musicapp-backend.onrender.com`).
   - *Note: Free Render instances "spin down" after 15 minutes of inactivity, so the first time you open the app after a while, it might take ~30 seconds to wake up.*

---

## Part 2: Connect the Frontend

Now that your backend is on the internet, you need to tell your app to talk to it instead of your local PC.

1. Open `frontend/.env`
2. Change the `EXPO_PUBLIC_API_URL` to your new Render URL:
   ```env
   EXPO_PUBLIC_API_URL=https://musicapp-backend.onrender.com
   ```
   *(Make sure there is no `/` at the very end of the URL)*

---

## Part 3: Build the APK for Global Use

Now we build the final Android app file (`.apk`) that you can send to your friends.

1. **Login to Expo CLI**
   Open your terminal in the `frontend` folder and run:
   ```bash
   eas login
   ```
   *(Log in with your Expo account from expo.dev)*

2. **Run the Build Command**
   ```bash
   eas build -p android --profile preview
   ```

3. **Share the Link!** 🚀
   - The build process happens in the cloud and takes about 10-15 minutes.
   - When it's done, the terminal will give you a **download link** to your `.apk` file.
   - Send that link to your friends! They just need to tap it on their Android phone to download and install the app.
