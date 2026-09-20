import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


SAMPLE_FIR_TEXTS = [
    {
        "fir_number": "FIR-2024-001",
        "title": "Organized Cash Heist at City Bank Branch",
        "description": "On 15-Jan-2024, an organized gang executed a sophisticated heist at the City Bank MG Road branch. Accused Rajesh Kumar led the operation with associates Suresh Patel and Vikram Singh. The gang used a white Toyota Innova (MH-12-AB-1234) as getaway vehicle. Phone records show multiple calls between Rajesh Kumar and an unknown handler at +919876543210. The loot was transported to a warehouse in Andheri East controlled by the D-Company network. Accused Mansoor Ahmed provided inside information as a bank employee. Evidence suggests funding from an offshore syndicate based in Dubai.",
        "date": "2024-01-15",
        "location": "Mumbai, Maharashtra",
        "ipc_sections": "395, 397, 420, 120B",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-002",
        "title": "Drug Trafficking Ring busted in Delhi",
        "description": "Delhi Police busted a major drug trafficking ring operating between Punjab and Delhi. Accused Harpreet Singh used multiple phone numbers (+918765432109, +919876543211) to coordinate shipments. Accused Amit Sharma managed distribution networks in Connaught Place and Karol Bagh. The operation was funded by an organized crime group called Punjab Syndicate. Vehicles used include a black Scorpio (DL-03-CD-5678) and a truck (PB-01-EF-9012). The main warehouse was located in Narela Industrial Area. Drug processing unit found in a farmhouse near Gurugram. Network extends to NCR region.",
        "date": "2024-02-20",
        "location": "New Delhi, NCR",
        "ipc_sections": "21, 22, 29 NDPS Act, 120B",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-003",
        "title": "Cyber Fraud Network operating from call centers",
        "description": "A cyber fraud network was uncovered operating from multiple call centers. Rakesh Verma and Priya Sharma ran the operation from an office in Noida Sector 62. The gang used VoIP phones and called victims across India. Accused Deepak Mehta handled the money mule accounts. Phone numbers used include +917654321098 and +918765432100. The operation was backed by a financial network called TechFin Solutions Pvt Ltd. Used a silver Honda City (UP-16-GH-3456) for transportation. Funds were routed through cryptocurrency wallets. Connected to a larger organized network operating from Southeast Asia.",
        "date": "2024-03-10",
        "location": "Noida, Uttar Pradesh",
        "ipc_sections": "420, 468, 471, 120B IT Act",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-004",
        "title": "Arms smuggling case in Hyderabad",
        "description": "Intelligence bureau flagged an arms smuggling operation in Hyderabad. Mohammed Ali and Faisal Khan were identified as key operatives. The smuggled weapons were hidden in a car workshop owned by Ali in Secunderabad. Vehicles used include a white Eeco (TS-09-JK-7890) and multiple motorcycles. Communication was done through encrypted channels but phone number +916543210987 was traced. The network operates under the name Khalsa Defence Group with links to interstate suppliers. Located in Barkas area of the old city. Connected cases in Karnataka and Tamil Nadu suggest a wider network.",
        "date": "2024-04-05",
        "location": "Hyderabad, Telangana",
        "ipc_sections": "3, 4, 5 Arms Act, 120B, 302",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-005",
        "title": "Human trafficking racket busted in Kolkata",
        "description": "A human trafficking racket was busted operating in and around Kolkata. Lakshmi Devi and Gopal Krishna were identified as the main accused. The racket used a placement agency called Bright Future Consultants as a front. Victims were transported using a minibus (WB-06-LM-2345). Communication was traced through phones +915432109876 and +916543210988. The operation was funded by a larger organized network called East Coast Crime Syndicate. Safe houses were identified in Salt Lake and Park Street areas. Connected to similar rackets in Odisha and Jharkhand.",
        "date": "2024-05-18",
        "location": "Kolkata, West Bengal",
        "ipc_sections": "370, 371, 120B, 420",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-006",
        "title": "Money laundering network through shell companies",
        "description": "ED and CBI jointly investigated a money laundering network operating through shell companies. Key accused Sanjay Mehta and Anita Desai created over 20 shell companies. The companies, including Skyline Trading Corp and Oceanic Ventures LLP, were used to route illicit funds. Used multiple phones including +914321098765. Office located in Bandra Kurla Complex, Mumbai. Vehicles used: a black Mercedes (MH-01-AB-1111) and Toyota Fortuner (MH-02-CD-2222). Connected to a hawala network with links to Dubai and Singapore. Part of a larger financial crimes syndicate.",
        "date": "2024-06-22",
        "location": "Mumbai, Maharashtra",
        "ipc_sections": "3, 4 PMLA, 120B, 420",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-007",
        "title": "Kidnapping for ransom in Bangalore",
        "description": "A kidnapping for ransom case was reported in Bangalore. Victim Abhishek Reddy was abducted by a gang led by Naveen Kumar and Joseph Thomas. The gang used a black Innova (KA-01-MN-4567) in the abduction. Communication was done using burner phones including +913210987654. Demands were made from a location in Electronic City. Ransom money was to be delivered at a warehouse in Peenya. The gang is suspected to be connected to a larger organized crime group operating in Karnataka. Safe house identified in Whitefield area.",
        "date": "2024-07-08",
        "location": "Bangalore, Karnataka",
        "ipc_sections": "364A, 34, 120B, 365",
        "status": "Under Investigation"
    },
    {
        "fir_number": "FIR-2024-008",
        "title": "Gold smuggling network at Chennai airport",
        "description": "Customs and DRI busted a gold smuggling network operating through Chennai airport. Key accused Mohammed Rafi and Senthil Kumar used air passengers to smuggle gold strips. The gold was melted and distributed by Rajeshwari Gold Traders. Communication traced to phones +912109876543 and +913210987655. Distribution network spans Tamil Nadu and Kerala. Vehicles used include a tempo (TN-01-OP-6789). The operation is funded by a Dubai-based syndicate. Multiple carriers identified operating on the Colombo-Chennai route.",
        "date": "2024-08-14",
        "location": "Chennai, Tamil Nadu",
        "ipc_sections": "135 Customs Act, 6, 7 FERA, 120B",
        "status": "Under Investigation"
    },
]


SAMPLE_ENTITIES = [
    # Persons
    {"name": "Rajesh Kumar", "entity_type": "Person", "properties": {"age": 42, "nationality": "Indian", "aliases": "Raju, King Rajesh"}},
    {"name": "Suresh Patel", "entity_type": "Person", "properties": {"age": 38, "nationality": "Indian", "aliases": ""}},
    {"name": "Vikram Singh", "entity_type": "Person", "properties": {"age": 35, "nationality": "Indian", "aliases": "Vicky"}},
    {"name": "Mansoor Ahmed", "entity_type": "Person", "properties": {"age": 45, "nationality": "Indian", "aliases": ""}},
    {"name": "Harpreet Singh", "entity_type": "Person", "properties": {"age": 39, "nationality": "Indian", "aliases": "Harry"}},
    {"name": "Amit Sharma", "entity_type": "Person", "properties": {"age": 33, "nationality": "Indian", "aliases": ""}},
    {"name": "Rakesh Verma", "entity_type": "Person", "properties": {"age": 36, "nationality": "Indian", "aliases": "Rocky"}},
    {"name": "Priya Sharma", "entity_type": "Person", "properties": {"age": 31, "nationality": "Indian", "aliases": ""}},
    {"name": "Deepak Mehta", "entity_type": "Person", "properties": {"age": 40, "nationality": "Indian", "aliases": ""}},
    {"name": "Mohammed Ali", "entity_type": "Person", "properties": {"age": 44, "nationality": "Indian", "aliases": "Ali Bhai"}},
    {"name": "Faisal Khan", "entity_type": "Person", "properties": {"age": 37, "nationality": "Indian", "aliases": ""}},
    {"name": "Lakshmi Devi", "entity_type": "Person", "properties": {"age": 50, "nationality": "Indian", "aliases": ""}},
    {"name": "Gopal Krishna", "entity_type": "Person", "properties": {"age": 48, "nationality": "Indian", "aliases": ""}},
    {"name": "Sanjay Mehta", "entity_type": "Person", "properties": {"age": 52, "nationality": "Indian", "aliases": "Sanju"}},
    {"name": "Anita Desai", "entity_type": "Person", "properties": {"age": 46, "nationality": "Indian", "aliases": ""}},
    {"name": "Naveen Kumar", "entity_type": "Person", "properties": {"age": 34, "nationality": "Indian", "aliases": ""}},
    {"name": "Joseph Thomas", "entity_type": "Person", "properties": {"age": 41, "nationality": "Indian", "aliases": "Jo"}},
    {"name": "Mohammed Rafi", "entity_type": "Person", "properties": {"age": 38, "nationality": "Indian", "aliases": ""}},
    {"name": "Senthil Kumar", "entity_type": "Person", "properties": {"age": 43, "nationality": "Indian", "aliases": ""}},
    {"name": "Abhishek Reddy", "entity_type": "Person", "properties": {"age": 28, "nationality": "Indian", "aliases": ""}},

    # Organizations
    {"name": "D-Company", "entity_type": "Organization", "properties": {"type": "Organized Crime", "origin": "Mumbai"}},
    {"name": "Punjab Syndicate", "entity_type": "Organization", "properties": {"type": "Drug Cartel", "origin": "Punjab"}},
    {"name": "TechFin Solutions Pvt Ltd", "entity_type": "Organization", "properties": {"type": "Shell Company", "origin": "Noida"}},
    {"name": "Khalsa Defence Group", "entity_type": "Organization", "properties": {"type": "Arms Smuggling", "origin": "Hyderabad"}},
    {"name": "East Coast Crime Syndicate", "entity_type": "Organization", "properties": {"type": "Organized Crime", "origin": "Kolkata"}},
    {"name": "Bright Future Consultants", "entity_type": "Organization", "properties": {"type": "Front Company", "origin": "Kolkata"}},
    {"name": "Skyline Trading Corp", "entity_type": "Organization", "properties": {"type": "Shell Company", "origin": "Mumbai"}},
    {"name": "Oceanic Ventures LLP", "entity_type": "Organization", "properties": {"type": "Shell Company", "origin": "Mumbai"}},
    {"name": "Rajeshwari Gold Traders", "entity_type": "Organization", "properties": {"type": "Gold Trading", "origin": "Chennai"}},
    {"name": "Dubai Network", "entity_type": "Organization", "properties": {"type": "Hawala/Finance", "origin": "Dubai"}},

    # Phones
    {"name": "+919876543210", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Jio"}},
    {"name": "+918765432109", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Airtel"}},
    {"name": "+919876543211", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Jio"}},
    {"name": "+917654321098", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Vi"}},
    {"name": "+918765432100", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Airtel"}},
    {"name": "+916543210987", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "BSNL"}},
    {"name": "+915432109876", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Jio"}},
    {"name": "+916543210988", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Airtel"}},
    {"name": "+914321098765", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Vi"}},
    {"name": "+913210987654", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Jio"}},
    {"name": "+913210987655", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "Airtel"}},
    {"name": "+912109876543", "entity_type": "Phone", "properties": {"type": "Mobile", "carrier": "BSNL"}},

    # Vehicles
    {"name": "MH-12-AB-1234", "entity_type": "Vehicle", "properties": {"type": "Toyota Innova", "color": "White"}},
    {"name": "DL-03-CD-5678", "entity_type": "Vehicle", "properties": {"type": "Mahindra Scorpio", "color": "Black"}},
    {"name": "PB-01-EF-9012", "entity_type": "Vehicle", "properties": {"type": "Truck", "color": "Blue"}},
    {"name": "UP-16-GH-3456", "entity_type": "Vehicle", "properties": {"type": "Honda City", "color": "Silver"}},
    {"name": "TS-09-JK-7890", "entity_type": "Vehicle", "properties": {"type": "Maruti Eeco", "color": "White"}},
    {"name": "WB-06-LM-2345", "entity_type": "Vehicle", "properties": {"type": "Minibus", "color": "Yellow"}},
    {"name": "MH-01-AB-1111", "entity_type": "Vehicle", "properties": {"type": "Mercedes", "color": "Black"}},
    {"name": "MH-02-CD-2222", "entity_type": "Vehicle", "properties": {"type": "Toyota Fortuner", "color": "White"}},
    {"name": "KA-01-MN-4567", "entity_type": "Vehicle", "properties": {"type": "Toyota Innova", "color": "Black"}},
    {"name": "TN-01-OP-6789", "entity_type": "Vehicle", "properties": {"type": "Tempo", "color": "White"}},

    # Locations
    {"name": "Mumbai", "entity_type": "Location", "properties": {"state": "Maharashtra", "type_info": "City"}},
    {"name": "Andheri East", "entity_type": "Location", "properties": {"state": "Maharashtra", "type_info": "Area", "city": "Mumbai"}},
    {"name": "New Delhi", "entity_type": "Location", "properties": {"state": "Delhi", "type_info": "City"}},
    {"name": "Connaught Place", "entity_type": "Location", "properties": {"state": "Delhi", "type_info": "Area", "city": "Delhi"}},
    {"name": "Narela Industrial Area", "entity_type": "Location", "properties": {"state": "Delhi", "type_info": "Industrial Area"}},
    {"name": "Noida Sector 62", "entity_type": "Location", "properties": {"state": "Uttar Pradesh", "type_info": "Area", "city": "Noida"}},
    {"name": "Hyderabad", "entity_type": "Location", "properties": {"state": "Telangana", "type_info": "City"}},
    {"name": "Secunderabad", "entity_type": "Location", "properties": {"state": "Telangana", "type_info": "Area", "city": "Hyderabad"}},
    {"name": "Barkas", "entity_type": "Location", "properties": {"state": "Telangana", "type_info": "Area", "city": "Hyderabad"}},
    {"name": "Kolkata", "entity_type": "Location", "properties": {"state": "West Bengal", "type_info": "City"}},
    {"name": "Salt Lake", "entity_type": "Location", "properties": {"state": "West Bengal", "type_info": "Area", "city": "Kolkata"}},
    {"name": "Bangalore", "entity_type": "Location", "properties": {"state": "Karnataka", "type_info": "City"}},
    {"name": "Electronic City", "entity_type": "Location", "properties": {"state": "Karnataka", "type_info": "Area", "city": "Bangalore"}},
    {"name": "Chennai", "entity_type": "Location", "properties": {"state": "Tamil Nadu", "type_info": "City"}},
    {"name": "Bandra Kurla Complex", "entity_type": "Location", "properties": {"state": "Maharashtra", "type_info": "Area", "city": "Mumbai"}},
]


SAMPLE_RELATIONSHIPS = [
    # Rajesh Kumar - Bank Heist
    ("Rajesh Kumar", "Suresh Patel", "ASSOCIATED_WITH"),
    ("Rajesh Kumar", "Vikram Singh", "ASSOCIATED_WITH"),
    ("Rajesh Kumar", "Mansoor Ahmed", "ASSOCIATED_WITH"),
    ("Rajesh Kumar", "D-Company", "MEMBER_OF"),
    ("Rajesh Kumar", "+919876543210", "USES"),
    ("Suresh Patel", "+918765432109", "USES"),
    ("Vikram Singh", "+919876543211", "USES"),
    ("Mansoor Ahmed", "TechFin Solutions Pvt Ltd", "MEMBER_OF"),
    ("MH-12-AB-1234", "Rajesh Kumar", "OWNS"),
    ("Rajesh Kumar", "Mumbai", "LOCATED_AT"),
    ("Mansoor Ahmed", "Andheri East", "LOCATED_AT"),

    # Drug ring
    ("Harpreet Singh", "Amit Sharma", "ASSOCIATED_WITH"),
    ("Harpreet Singh", "Punjab Syndicate", "MEMBER_OF"),
    ("Harpreet Singh", "+918765432109", "USES"),
    ("Harpreet Singh", "+919876543211", "USES"),
    ("Amit Sharma", "+917654321098", "USES"),
    ("Amit Sharma", "+918765432100", "USES"),
    ("DL-03-CD-5678", "Harpreet Singh", "OWNS"),
    ("PB-01-EF-9012", "Harpreet Singh", "OWNS"),
    ("Harpreet Singh", "New Delhi", "LOCATED_AT"),
    ("Amit Sharma", "Connaught Place", "LOCATED_AT"),
    ("Punjab Syndicate", "New Delhi", "LOCATED_AT"),

    # Cyber fraud
    ("Rakesh Verma", "Priya Sharma", "ASSOCIATED_WITH"),
    ("Rakesh Verma", "Deepak Mehta", "ASSOCIATED_WITH"),
    ("Rakesh Verma", "TechFin Solutions Pvt Ltd", "MEMBER_OF"),
    ("Priya Sharma", "TechFin Solutions Pvt Ltd", "MEMBER_OF"),
    ("Deepak Mehta", "TechFin Solutions Pvt Ltd", "MEMBER_OF"),
    ("Rakesh Verma", "+917654321098", "USES"),
    ("Priya Sharma", "+918765432100", "USES"),
    ("Deepak Mehta", "+914321098765", "USES"),
    ("UP-16-GH-3456", "Rakesh Verma", "OWNS"),
    ("Rakesh Verma", "Noida Sector 62", "LOCATED_AT"),

    # Arms smuggling
    ("Mohammed Ali", "Faisal Khan", "ASSOCIATED_WITH"),
    ("Mohammed Ali", "Khalsa Defence Group", "MEMBER_OF"),
    ("Faisal Khan", "Khalsa Defence Group", "MEMBER_OF"),
    ("Mohammed Ali", "+916543210987", "USES"),
    ("TS-09-JK-7890", "Mohammed Ali", "OWNS"),
    ("Mohammed Ali", "Secunderabad", "LOCATED_AT"),
    ("Faisal Khan", "Barkas", "LOCATED_AT"),
    ("Khalsa Defence Group", "Hyderabad", "LOCATED_AT"),

    # Human trafficking
    ("Lakshmi Devi", "Gopal Krishna", "ASSOCIATED_WITH"),
    ("Lakshmi Devi", "Bright Future Consultants", "MEMBER_OF"),
    ("Gopal Krishna", "Bright Future Consultants", "MEMBER_OF"),
    ("Lakshmi Devi", "East Coast Crime Syndicate", "MEMBER_OF"),
    ("Gopal Krishna", "East Coast Crime Syndicate", "MEMBER_OF"),
    ("Lakshmi Devi", "+915432109876", "USES"),
    ("Gopal Krishna", "+916543210988", "USES"),
    ("WB-06-LM-2345", "Lakshmi Devi", "OWNS"),
    ("Lakshmi Devi", "Salt Lake", "LOCATED_AT"),
    ("Gopal Krishna", "Kolkata", "LOCATED_AT"),
    ("East Coast Crime Syndicate", "Kolkata", "LOCATED_AT"),

    # Money laundering
    ("Sanjay Mehta", "Anita Desai", "ASSOCIATED_WITH"),
    ("Sanjay Mehta", "Skyline Trading Corp", "MEMBER_OF"),
    ("Anita Desai", "Skyline Trading Corp", "MEMBER_OF"),
    ("Sanjay Mehta", "Oceanic Ventures LLP", "MEMBER_OF"),
    ("Anita Desai", "Oceanic Ventures LLP", "MEMBER_OF"),
    ("Sanjay Mehta", "+914321098765", "USES"),
    ("Anita Desai", "+913210987654", "USES"),
    ("MH-01-AB-1111", "Sanjay Mehta", "OWNS"),
    ("MH-02-CD-2222", "Anita Desai", "OWNS"),
    ("Sanjay Mehta", "Bandra Kurla Complex", "LOCATED_AT"),
    ("Sanjay Mehta", "Dubai Network", "MEMBER_OF"),

    # Kidnapping
    ("Naveen Kumar", "Joseph Thomas", "ASSOCIATED_WITH"),
    ("Naveen Kumar", "+913210987654", "USES"),
    ("Joseph Thomas", "+913210987655", "USES"),
    ("KA-01-MN-4567", "Naveen Kumar", "OWNS"),
    ("Naveen Kumar", "Electronic City", "LOCATED_AT"),
    ("Joseph Thomas", "Bangalore", "LOCATED_AT"),

    # Gold smuggling
    ("Mohammed Rafi", "Senthil Kumar", "ASSOCIATED_WITH"),
    ("Mohammed Rafi", "Rajeshwari Gold Traders", "MEMBER_OF"),
    ("Senthil Kumar", "Rajeshwari Gold Traders", "MEMBER_OF"),
    ("Mohammed Rafi", "+912109876543", "USES"),
    ("Senthil Kumar", "+913210987655", "USES"),
    ("TN-01-OP-6789", "Rajeshwari Gold Traders", "OWNS"),
    ("Mohammed Rafi", "Chennai", "LOCATED_AT"),
    ("Rajeshwari Gold Traders", "Chennai", "LOCATED_AT"),

    # Cross-network connections
    ("D-Company", "Dubai Network", "ASSOCIATED_WITH"),
    ("Punjab Syndicate", "Dubai Network", "ASSOCIATED_WITH"),
    ("Rajesh Kumar", "Harpreet Singh", "ASSOCIATED_WITH"),
    ("Sanjay Mehta", "Rajesh Kumar", "ASSOCIATED_WITH"),
    ("TechFin Solutions Pvt Ltd", "Skyline Trading Corp", "ASSOCIATED_WITH"),
    ("East Coast Crime Syndicate", "Khalsa Defence Group", "ASSOCIATED_WITH"),
    ("Amit Sharma", "Rakesh Verma", "ASSOCIATED_WITH"),
    ("Deepak Mehta", "Sanjay Mehta", "ASSOCIATED_WITH"),
    ("Naveen Kumar", "Mohammed Rafi", "ASSOCIATED_WITH"),
]


def load_sample_data(db_service):
    """Load all sample data into Neo4j."""
    print("Clearing existing data...")
    db_service.clear_database()

    print("Setting up indexes...")
    db_service.setup_indexes()

    print("Creating crime records...")
    crime_ids = {}
    for record in SAMPLE_FIR_TEXTS:
        result = db_service.create_crime_record(record)
        crime_ids[record["fir_number"]] = result["id"]
        print(f"  Created: {record['fir_number']} - {record['title']}")

    print("\nCreating entities...")
    entity_map = {}
    for ent_data in SAMPLE_ENTITIES:
        result = db_service.find_or_create_entity(
            ent_data["entity_type"],
            ent_data["name"],
            ent_data.get("properties", {})
        )
        entity_map[ent_data["name"]] = result["id"]
        print(f"  Created: [{ent_data['entity_type']}] {ent_data['name']}")

    print(f"\n  Total entities created: {len(entity_map)}")

    print("\nCreating relationships...")
    rel_count = 0
    failed_rels = []
    for source_name, target_name, rel_type in SAMPLE_RELATIONSHIPS:
        source_id = entity_map.get(source_name)
        target_id = entity_map.get(target_name)
        if source_id and target_id:
            db_service.create_relationship(source_id, target_id, rel_type)
            rel_count += 1
        else:
            failed_rels.append(f"{source_name} -> {target_name}")

    print(f"  Created {rel_count} entity relationships")
    if failed_rels:
        print(f"  Failed: {failed_rels}")

    print("\nLinking entities to crime records...")
    entity_crime_links = [
        ("Rajesh Kumar", "FIR-2024-001", "SUSPECTED_IN"),
        ("Suresh Patel", "FIR-2024-001", "SUSPECTED_IN"),
        ("Vikram Singh", "FIR-2024-001", "SUSPECTED_IN"),
        ("Mansoor Ahmed", "FIR-2024-001", "SUSPECTED_IN"),
        ("Harpreet Singh", "FIR-2024-002", "SUSPECTED_IN"),
        ("Amit Sharma", "FIR-2024-002", "SUSPECTED_IN"),
        ("Rakesh Verma", "FIR-2024-003", "SUSPECTED_IN"),
        ("Priya Sharma", "FIR-2024-003", "SUSPECTED_IN"),
        ("Deepak Mehta", "FIR-2024-003", "SUSPECTED_IN"),
        ("Mohammed Ali", "FIR-2024-004", "SUSPECTED_IN"),
        ("Faisal Khan", "FIR-2024-004", "SUSPECTED_IN"),
        ("Lakshmi Devi", "FIR-2024-005", "SUSPECTED_IN"),
        ("Gopal Krishna", "FIR-2024-005", "SUSPECTED_IN"),
        ("Sanjay Mehta", "FIR-2024-006", "SUSPECTED_IN"),
        ("Anita Desai", "FIR-2024-006", "SUSPECTED_IN"),
        ("Naveen Kumar", "FIR-2024-007", "SUSPECTED_IN"),
        ("Joseph Thomas", "FIR-2024-007", "SUSPECTED_IN"),
        ("Abhishek Reddy", "FIR-2024-007", "VICTIM_IN"),
        ("Mohammed Rafi", "FIR-2024-008", "SUSPECTED_IN"),
        ("Senthil Kumar", "FIR-2024-008", "SUSPECTED_IN"),
    ]

    link_count = 0
    for entity_name, fir_number, rel_type in entity_crime_links:
        entity_id = entity_map.get(entity_name)
        crime_id = crime_ids.get(fir_number)
        if entity_id and crime_id:
            db_service.link_entity_to_crime(entity_id, crime_id, rel_type)
            link_count += 1

    print(f"  Created {link_count} entity-crime links")

    print("\nSample data loaded successfully!")
    print(f"  Crime Records: {len(SAMPLE_FIR_TEXTS)}")
    print(f"  Entities: {len(entity_map)}")
    print(f"  Entity-Entity Relationships: {rel_count}")
    print(f"  Entity-Crime Relationships: {link_count}")
