import { NextRequest, NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  sessionCookie
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    if (!checkCredentials(username, password)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie.name, token, {
      ...sessionCookie.options,
      maxAge: sessionCookie.maxAge
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Login failed" },
      { status: 500 }
    );
  }
}
