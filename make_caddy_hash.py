import getpass
import sys

sys.path.insert(0, r"C:\Users\Hatsune\Documents\Codex\2026-08-20\hwe28c5rcqmwfy01a1-x20\work\sshlib_runtime")
import bcrypt


password = getpass.getpass("Storyboard access password: ").encode("utf-8")
print(bcrypt.hashpw(password, bcrypt.gensalt(rounds=14)).decode("ascii"))
