import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { getAnimationToolsList } from "@/libs/animation_tools";

export const dynamic = "force-dynamic";

/**
 * GET /api/engine/tools
 * Returns the list of available animation tools for the UI selector.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tools = getAnimationToolsList();
    return NextResponse.json({ tools });
  } catch (error) {
    console.error("Tools error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
