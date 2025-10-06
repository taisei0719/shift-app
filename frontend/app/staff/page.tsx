"use client";

import React from "react";
import Link from "next/link";

export default function Staff({ user }) {
  return (
    <>
      <h1>スタッフ画面</h1>
      <div style={{ textAlign: "center", marginTop: 30 }}>
        <Link href="/shift_input" className="button-link">
          シフト提出
        </Link>
      </div>
    </>
  );
}
