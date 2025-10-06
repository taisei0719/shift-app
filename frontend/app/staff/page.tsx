// frontend/pages/staff.js
import React from "react";
import Link from "next/link";
import Layout from "../components/Layout";

export default function Staff({ user }) {
  return (
    <Layout user={user}>
      <h1>スタッフ画面</h1>
      <div style={{ textAlign: "center", marginTop: 30 }}>
        <Link href="/shift_input">
          <a className="button-link">シフト提出</a>
        </Link>
      </div>
    </Layout>
  );
}
