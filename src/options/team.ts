import axios from 'axios';
import * as vscode from 'vscode';
import { INVITE, TEAM } from '../helpers/api';
import { AuthService, createTeamTree } from '../helpers/auth';

type Member = {
  email: string,
  isInvitePending: boolean,
};

type Team = {
  admin: string,
  members: Member[]
};

vscode.commands.registerCommand('docs.invite', async (authService: AuthService) => {
  const email = await vscode.window.showInputBox({
    title: 'Invite memember adding their email',
    placeHolder: 'hi@example.com',
    validateInput: (email) => {
      if (/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
        return null;
      }

      return 'Please enter a valid email address';
    }
  });

  if (!email) {
    return null;
  }

  try {
    await axios.post(INVITE, {
      fromEmail: authService.getEmail(),
      toEmail: email
    });
    vscode.window.showInformationMessage('Invite sent to ' + email);
    createTeamTree(authService);
  } catch (error: any) {
    vscode.window.showErrorMessage(error?.response?.data?.error);
  }
});

vscode.commands.registerCommand('docs.removeMember', async (authService, email) => {
  try {
    await axios.delete(INVITE, {
      data: {
        fromEmail: authService.getEmail(),
        toEmail: email
      }
    });
    createTeamTree(authService);
  } catch (error: any) {
    vscode.window.showErrorMessage(error?.response?.data?.error);
  }
});

export class TeamProvider implements vscode.TreeDataProvider<TeamMemberItem> {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  getTreeItem(element: TeamMemberItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<any[]> {
    if (element) {
      return [new RemoveMemberItem(this.authService, element.id)];
    }

    if (!this.authService.getUpgradedStatus()) {
      return [new UpgradeMemberItem()];
    }

    const email = this.authService.getEmail();
    const { data: team }: { data: Team } = await axios.get(`${TEAM}?email=${email}`);
    const adminTreeItem = new TeamMemberItem(team.admin, team.admin === email, true);
    const membersTreeItems = team.members.map(
      member => new TeamMemberItem(member.email, member.email === email, false, member.isInvitePending)
    );
    return [adminTreeItem, ...membersTreeItems, new AddMemberItem(this.authService)];
  }
}

class TeamMemberItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly isSelf: boolean,
    public readonly isAdmin: boolean,
    public readonly isInvitePending: boolean = false,
  ) {
    super(name, isSelf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
    this.id = name;

    if (isAdmin) {
      this.description = 'Admin';
    }
    if (isInvitePending) {
      this.description = 'Invited';
    }
    if (isSelf) {
      this.iconPath = new vscode.ThemeIcon('account');
    }
  }
}

class AddMemberItem extends vscode.TreeItem {
  constructor(authService: AuthService) {
    super('Invite Member', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('add');

    this.command = {
      title: 'Invite Member',
      command: 'docs.invite',
      arguments: [authService]
    };
  }
}

class RemoveMemberItem extends vscode.TreeItem {
  constructor(authService: AuthService, email?: string) {
    super('Remove Member', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('trash');

    this.command = {
      title: 'Remove Member',
      command: 'docs.removeMember',
      arguments: [authService, email]
    };
  }
}

class UpgradeMemberItem extends vscode.TreeItem {
  constructor() {
    super('Upgrade to invite members', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('lock');

    this.command = {
      title: 'Show Upgrade Info Message',
      command: 'docs.upgradeInfo',
      arguments: ['Upgrade to a teams plan to invite members', '🔐 Upgrade']
    };
  }
}