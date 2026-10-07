from datetime import date

import click

from app.extensions import db
from app.models import DeliveryMode, Intake, IntakeStatus, Programme, Setting, User, UserRole

# PLACEHOLDER programmes for development. Replace with KSTVET's real CPD list when it arrives.
SAMPLE_PROGRAMMES = [
    {
        "slug": "competency-based-assessment",
        "title": "Competency-Based Assessment for TVET Trainers",
        "category": "Pedagogy",
        "summary": "Plan, conduct and document competency-based assessments in line with CBET requirements.",
        "target_audience": "TVET trainers and assessors",
        "learning_outcomes": "Design assessment tools\nConduct practical assessments\nRecord and moderate results",
        "duration_text": "5 days",
        "mode": DeliveryMode.PHYSICAL,
        "cpd_hours": 40,
        "fee_kes": 25000,
        "intakes": [
            (date(2026, 11, 9), date(2026, 11, 13), date(2026, 10, 30)),
            (date(2027, 2, 8), date(2027, 2, 12), date(2027, 1, 29)),
        ],
    },
    {
        "slug": "digital-skills-for-trainers",
        "title": "Digital Skills for Trainers",
        "category": "ICT",
        "summary": "Use digital tools, learning management systems and online content in TVET delivery.",
        "target_audience": "Trainers and academic staff",
        "learning_outcomes": "Create digital learning content\nRun blended classes\nUse an LMS effectively",
        "duration_text": "3 days",
        "mode": DeliveryMode.BLENDED,
        "cpd_hours": 24,
        "fee_kes": 18000,
        "intakes": [
            (date(2026, 11, 23), date(2026, 11, 25), date(2026, 11, 13)),
        ],
    },
    {
        "slug": "leadership-and-management-in-tvet",
        "title": "Leadership and Management in TVET Institutions",
        "category": "Leadership",
        "summary": "Strengthen leadership, planning and people management skills for TVET managers.",
        "target_audience": "Principals, deputy principals, HODs",
        "learning_outcomes": "Lead institutional change\nPlan and manage resources\nManage performance",
        "duration_text": "5 days",
        "mode": DeliveryMode.PHYSICAL,
        "cpd_hours": 40,
        "fee_kes": 35000,
        "intakes": [
            (date(2026, 12, 7), date(2026, 12, 11), date(2026, 11, 27)),
            (date(2027, 3, 8), date(2027, 3, 12), date(2027, 2, 26)),
        ],
    },
]

DEFAULT_SETTINGS = {
    "letter_signatory_name": "Mr. Thomas Kitonyi",
    "letter_signatory_title": "Ag. Director Academics & Student Affairs, for Chief Executive Officer",
    "payment_instructions": "PLACEHOLDER: bank / M-Pesa paybill details to be provided by KSTVET",
    "cpd_office_email": "info@kstvet.ac.ke",
    "cpd_office_phone": "+254 707444222",
}


def register_cli(app):
    @app.cli.command("seed")
    def seed():
        """Load sample programmes, intakes and default settings (safe to run twice)."""
        added = 0
        for p in SAMPLE_PROGRAMMES:
            if db.session.scalar(db.select(Programme).filter_by(slug=p["slug"])):
                continue
            data = {k: v for k, v in p.items() if k != "intakes"}
            programme = Programme(**data, is_published=True)
            for start, end, deadline in p["intakes"]:
                programme.intakes.append(
                    Intake(
                        start_date=start,
                        end_date=end,
                        application_deadline=deadline,
                        venue="KSTVET Campus, Nairobi",
                        capacity=40,
                        reporting_time="8:00 AM",
                        status=IntakeStatus.OPEN,
                    )
                )
            db.session.add(programme)
            added += 1

        for key, value in DEFAULT_SETTINGS.items():
            if not db.session.get(Setting, key):
                db.session.add(Setting(key=key, value=value))

        db.session.commit()
        click.echo(f"Seed complete: {added} programme(s) added.")

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--name", prompt="Full name")
    @click.password_option()
    def create_admin(email, name, password):
        """Create an admin user."""
        if db.session.scalar(db.select(User).filter_by(email=email.lower())):
            click.echo("A user with that email already exists.")
            return
        user = User(email=email.lower(), full_name=name, role=UserRole.ADMIN)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f"Admin {email} created.")