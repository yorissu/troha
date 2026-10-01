
"""Sending email: password reset links and confirming a new address.

With TROHA_SMTP_HOST set, mail goes through that mail server (a mail provider's,
e.g. Postmark, Resend or a Gmail app password: mail sent straight from a home
connection usually lands in spam). Without it, each email is printed to the log
instead, which is handy while trying Troha out (docker compose logs troha-server).

Sending happens in the background, so a slow mail server doesn't hold up the page.
"""

import logging
import smtplib
import ssl
import threading
from email.message import EmailMessage


log = logging.getLogger("troha.mail")


class Mailer:
	def __init__(self, smtp):
		"""@param smtp settings.Smtp, or None to print emails to the log."""
		self._smtp = smtp

	def send(self, to, subject, text):
		"""Sends an email in the background."""
		threading.Thread(target=self._send, args=(to, subject, text), daemon=True).start()

	def _send(self, to, subject, text):
		smtp = self._smtp
		if smtp is None:
			log.warning("No mail server set up (TROHA_SMTP_HOST), so here's the email instead.\nTo: %s\nSubject: %s\n\n%s", to, subject, text)
			return
		message = EmailMessage()
		message["From"] = smtp.sender
		message["To"] = to
		message["Subject"] = subject
		message.set_content(text)
		try:
			if smtp.security == "ssl":
				server = smtplib.SMTP_SSL(smtp.host, smtp.port, context=ssl.create_default_context(), timeout=30)
			else:
				server = smtplib.SMTP(smtp.host, smtp.port, timeout=30)
			with server:
				if smtp.security == "starttls":
					server.starttls(context=ssl.create_default_context())
				if smtp.user:
					server.login(smtp.user, smtp.password)
				server.send_message(message)
		except (OSError, smtplib.SMTPException) as error:
			log.error("Couldn't send an email (%s): %s", subject, error)
