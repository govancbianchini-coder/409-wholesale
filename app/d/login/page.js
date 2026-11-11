import LoginClient from "./LoginClient";

export const metadata = { title: "Sign in · Overbid" };

export default async function DealerLogin({ searchParams }) {
  const sp = await searchParams;
  return <LoginClient next={sp?.next || "/d"} />;
}
