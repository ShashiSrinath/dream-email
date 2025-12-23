import React from "react";
import ReactDOM from "react-dom/client";
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import {Menu} from "@tauri-apps/api/menu/menu";

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { createRouter, RouterProvider } from "@tanstack/react-router";

async function initSystray() {
    const menu = await Menu.new({
        items: [
            {
                id: 'quit',
                text: 'Quit',
            },
        ],
    });

    await TrayIcon.new({
        icon: (await defaultWindowIcon())!,
        tooltip: "Dream Email",
        menu
    });
}

initSystray().then(() => {
    console.log("Systray initialized");
});

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
