import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Inbox, Mail, Plus, Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Link, useSearch } from "@tanstack/react-router"
import { Gmail } from "@/components/ui/svgs/gmail"

type Account = {
  id?: number;
  type: "google";
  data: {
    email: string;
    name?: string;
    picture?: string;
  };
};

type Folder = {
  id: number;
  account_id: number;
  name: string;
  path: string;
  role?: string;
  unread_count: number;
};

export function AppSidebar() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountFolders, setAccountFolders] = useState<Record<number, Folder[]>>({})
  const search = useSearch({ from: '/' })

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await invoke<Account[]>("get_accounts")
        setAccounts(data)
        
        // Fetch folders for each account
        for (const account of data) {
          if (account.id) {
            const folders = await invoke<Folder[]>("get_folders", { accountId: account.id })
            setAccountFolders(prev => ({ ...prev, [account.id!]: folders }))
          }
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchAccounts()
  }, [])

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b h-16 justify-center">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="bg-primary text-primary-foreground p-1 rounded-lg">
            <Mail className="w-6 h-6" />
          </div>
          <span>Dream Email</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={!search.accountId && !search.folderId}>
                   <Link to="/" search={{ accountId: undefined, folderId: undefined }}>
                    <Inbox className="w-4 h-4" />
                    <span>Unified Inbox</span>
                   </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Accounts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accounts.map((account) => (
                <SidebarMenuItem key={account.data.email}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={account.data.email}
                    isActive={search.accountId === account.id && !search.folderId}
                  >
                    <Link to="/" search={{ accountId: account.id, folderId: undefined }}>
                        {account.type === 'google' ? <Gmail className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                        <span>{account.data.name || account.data.email}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {account.id && accountFolders[account.id]?.map((folder) => (
                        <SidebarMenuSubItem key={folder.id}>
                            <SidebarMenuSubButton asChild isActive={search.folderId === folder.id}>
                                <Link to="/" search={{ accountId: account.id, folderId: folder.id }}>
                                    <span className="truncate">{folder.name}</span>
                                    {folder.unread_count > 0 && (
                                        <span className="ml-auto text-[10px] bg-primary text-primary-foreground px-1.5 rounded-full">
                                            {folder.unread_count}
                                        </span>
                                    )}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/accounts/new-account">
                    <Plus className="w-4 h-4" />
                    <span>Add Account</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link to="/">
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}