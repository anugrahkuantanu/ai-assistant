import { Id } from "@/convex/_generated/dataModel"
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getConvexClient } from "@/lib/convex"
import { api } from "@/convex/_generated/api";
import ChatInterface from "@/components/ChatInterface";

interface ChatPageProps {
    params: {
        chatId: Id<"chats">;
    }
}

export default async function ChatPage({params}: ChatPageProps) {
    const { chatId } = await params;

    const { userId } = await auth();
    
    if (!userId){
        redirect("/");
    }

    try{

        const convex = getConvexClient();

        const chat = await convex.query(api.chats.getChat, {
            id: chatId,
            userId,
        })

        if(!chat){
            console.log(
                "⚠️ Chat not found or unauthorized, redirecting to dashboard"
              );
            redirect("/dashboard");
        }

        const initialMessages = await convex.query(api.messages.list, { chatId });

        return(
            <div>
                <ChatInterface chatId={chatId} initialMessages={initialMessages}/>
            </div>
        )
    }catch (error){
        console.error("🔥 Error loading chat:", error);
        redirect("/dashboard")
    }
}