import argparse
import base64
import getpass
import hashlib
import socket
import sys

sys.path.insert(0, r"C:\Users\Hatsune\Documents\Codex\2026-08-20\hwe28c5rcqmwfy01a1-x20\work\sshlib_runtime")
import paramiko


def fingerprint(host: str, port: int) -> str:
    sock = socket.create_connection((host, port), timeout=10)
    transport = paramiko.Transport(sock)
    try:
        transport.start_client(timeout=10)
        key = transport.get_remote_server_key()
        digest = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
        return f"{key.get_name()} SHA256:{digest}"
    finally:
        transport.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("host")
    parser.add_argument("script_file")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--expected-fingerprint")
    args = parser.parse_args()

    actual = fingerprint(args.host, args.port)
    print("HOST_KEY", actual, flush=True)
    if args.expected_fingerprint and actual != args.expected_fingerprint:
        raise RuntimeError("Host key fingerprint mismatch")

    password = getpass.getpass("SSH/sudo password: ")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        args.host,
        port=args.port,
        username=args.user,
        password=password,
        timeout=10,
        auth_timeout=15,
        banner_timeout=15,
        look_for_keys=False,
        allow_agent=False,
    )
    try:
        stdin, stdout, stderr = client.exec_command("sudo -S -p '' bash -s", timeout=args.timeout)
        stdin.write(password + "\n")
        with open(args.script_file, "r", encoding="utf-8", newline="\n") as handle:
            stdin.write(handle.read())
        stdin.close()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out:
            print(out, end="" if out.endswith("\n") else "\n")
        if err:
            print(err, file=sys.stderr, end="" if err.endswith("\n") else "\n")
        return code
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
