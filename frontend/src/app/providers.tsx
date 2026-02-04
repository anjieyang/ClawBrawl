'use client'

import {NextUIProvider} from '@nextui-org/react'
import {ThemeProvider as NextThemesProvider} from "next-themes";
import ChatRoom from "@/components/ui/ChatRoom";

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <NextUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
        {children}
        {/* ChatRoom lives at the provider level - global chat room for the whole site */}
        <ChatRoom />
      </NextThemesProvider>
    </NextUIProvider>
  )
}
