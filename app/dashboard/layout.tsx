"use client";


import Header from "@/components/Header";
import { ModelConfigProvider } from "@/components/ModelConfigProvider";
import Sidebar from "@/components/Sidebar";
import { NavigationProvider } from "@/lib/context/navigation";
import { Authenticated } from "convex/react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ModelConfigProvider>
            <NavigationProvider>
                <div className="flex h-screen">
                    <Authenticated>
                        <Sidebar />
                        <div />
                    </Authenticated>

                    <div className="flex-1 flex flex-col min-w-0">
                        <Header />
                        <main className="flex-1 overflow-y-auto">{children}</main>
                    </div>
                </div>
            </NavigationProvider>
        </ModelConfigProvider>
    );
}
