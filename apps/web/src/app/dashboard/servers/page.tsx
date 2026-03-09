"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("servers");
  const tCommon = useTranslations("common");
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
        return <Badge variant="success">{tCommon("online")}</Badge>;
      case "offline":
        return <Badge variant="secondary">{tCommon("offline")}</Badge>;
      case "error":
        return <Badge variant="error">{tCommon("error")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => checkStatus.mutate()}
            disabled={checkStatus.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkStatus.isPending ? "animate-spin" : ""}`} />
            {t("checkStatus")}
          </Button>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncServers.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncServers.isPending ? "animate-spin" : ""}`} />
            {t("syncAll")}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("addServer")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              {createdToken ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{t("serverCreated")}</DialogTitle>
                    <DialogDescription>
                      {t("saveAgentToken")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("agentToken")}</Label>
                      <div className="flex gap-2">
                        <Input value={createdToken} readOnly className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={handleCopyToken}>
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreate}>{tCommon("done")}</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>{t("addServer")}</DialogTitle>
                    <DialogDescription>
                      {t("addNewServer")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("name")}</Label>
                      <Input
                        id="name"
                        placeholder="Germany 1"
                        value={newServer.name}
                        onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="host">{t("host")}</Label>
                      <Input
                        id="host"
                        placeholder="de1.example.com"
                        value={newServer.host}
                        onChange={(e) => setNewServer({ ...newServer, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agentUrl">{t("agentUrl")}</Label>
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
                      {createServer.isPending ? t("creating") : t("create")}
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
              {t("syncedSuccess", { servers: syncServers.data.servers, clients: syncServers.data.clients })}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("allServers")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{tCommon("loading")}</p>
          ) : servers?.length === 0 ? (
            <p className="text-muted-foreground">{t("noServers")}</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("host")}</TableHead>
                  <TableHead>{t("agentUrl")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="w-[100px]">{t("actions")}</TableHead>
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
