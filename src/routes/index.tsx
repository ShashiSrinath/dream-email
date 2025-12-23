import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button.tsx";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: App,
});

type Account = {
  type: "google";
  access_token: string;
  refresh_token?: string;
};

function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    invoke<Account[]>("get_accounts").then(setAccounts).catch(console.error);
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button asChild>
          <Link to="/accounts/new-account">Add Account</Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <p className="text-muted-foreground">No accounts added yet.</p>
        ) : (
          accounts.map((account, i) => (
            <Card key={i}>
              <CardHeader className="p-4">
                <CardTitle className="text-lg capitalize">
                  {account.type} Account
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground truncate">
                  Token: {account.access_token.substring(0, 10)}...
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
