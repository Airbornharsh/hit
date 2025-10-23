package repo

func PullRemote(remoteName, targetBranch string) error {
	err := FetchRemote(remoteName)
	if err != nil {
		return err
	}

	err = MergeBranch(targetBranch, targetBranch, remoteName)
	if err != nil {
		return err
	}

	return nil
}
