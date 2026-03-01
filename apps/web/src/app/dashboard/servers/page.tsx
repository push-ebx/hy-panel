"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useServers, useCreateServer, useDeleteServer, useSyncServers, useCheckServersStatus } from "@/lib/hooks";

export default function ServersPage() {
  const { data: servers, isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const syncServers = useSyncServers();
  const checkStatus = useCheckServersStatus();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newServer, setNewServer] = useState({ name: "", host: "", agentUrl: "" });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const result = await createServer.mutateAsync(newServer);
    setCreatedToken(result.agentToken);
    setNewServer({ name: "", host: "", agentUrl: "" });
  };

  const handleCopyToken = () => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setCreatedToken(null);
  };

  const handleSync = () => {
    syncServers.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge variant="success">Online</Badge>;
      case "offline":
        return <Badge variant="secondary">Offline</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">Servers</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => checkStatus.mutate()}
            disabled={checkStatus.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkStatus.isPending ? "animate-spin" : ""}`} />
            Check status
          </Button>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncServers.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncServers.isPending ? "animate-spin" : ""}`} />
            Sync All
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              {createdToken ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Server Created</DialogTitle>
                    <DialogDescription>
                      Save the agent token. It won&apos;t be shown again.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Agent Token</Label>
                      <div className="flex gap-2">
                        <Input value={createdToken} readOnly className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={handleCopyToken}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreate}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Add Server</DialogTitle>
                    <DialogDescription>
                      Add a new Hysteria2 server to manage.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Germany 1"
                        value={newServer.name}
                        onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        placeholder="de1.example.com"
                        value={newServer.host}
                        onChange={(e) => setNewServer({ ...newServer, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agentUrl">Agent URL</Label>
                      <Input
                        id="agentUrl"
                        placeholder="http://123.45.67.89:8080"
                        value={newServer.agentUrl}
                        onChange={(e) => setNewServer({ ...newServer, agentUrl: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreate}
                      disabled={createServer.isPending || !newServer.name || !newServer.host || !newServer.agentUrl}
                    >
                      {createServer.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {syncServers.isSuccess && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-green-500">
              Synced {syncServers.data.servers} servers, imported {syncServers.data.clients} clients
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Servers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : servers?.length === 0 ? (
            <p className="text-muted-foreground">No servers yet. Add your first server.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Agent URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers?.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell>{server.host}</TableCell>
                    <TableCell className="font-mono text-sm">{server.agentUrl}</TableCell>
                    <TableCell>{getStatusBadge(server.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteServer.mutate(server.id)}
                        disabled={deleteServer.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
